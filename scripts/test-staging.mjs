/**
 * test-staging.mjs — volledige stagingtest voor Oyaa
 *
 * Dekt:
 *   TD  — intent-detectie unit tests (hasGenerateIntent-regex, incl. fix vandaag)
 *   TR  — recordings + threads CRUD via HTTP
 *   TC  — chat-custom SSE: alle Chase documenttypes vanuit recording (knop-pad)
 *   TDB — chat-custom SSE: DB-fallback transcript (geen recordingTranscript, wel recordingThreadId)
 *   TI  — chat-custom SSE: intent detectie via intypen ("Maak een samenvatting")
 *   TQ  — chat-custom SSE: vragen over transcript, geen documentgeneratie
 *   TF  — chat-custom SSE: vrij gesprek zonder audio
 *   TA  — chat-custom SSE: All Day types (allday-gespreksverslag, allday-debrief)
 *
 * Vereisten in .env.local of .env.vercel:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   ANTHROPIC_API_KEY (niet nodig voor HTTP-tests, alleen voor directe API-calls)
 *   OYAA_TEST_BASE_URL (optioneel, default: http://localhost:3000)
 *   OYAA_TEST_EMAIL    (optioneel, default: ruben@chase.amsterdam)
 *
 * Run: node scripts/test-staging.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function parseEnvFile(path) {
  try {
    const raw = readFileSync(path, 'utf8');
    const result = {};
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=["']?(.+?)["']?\s*$/);
      if (m) result[m[1]] = m[2];
    }
    return result;
  } catch { return {}; }
}

const env = {
  ...parseEnvFile(resolve(root, '.env.vercel')),
  ...parseEnvFile(resolve(root, '.env.local')),
  // Command-line env vars overschrijven bestandswaarden
  ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('OYAA_') || k.startsWith('NEXT_PUBLIC_') || k.startsWith('SUPABASE_') || k.startsWith('ANTHROPIC_'))),
};

const SUPABASE_URL  = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE  = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY      = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!env.OYAA_TEST_BASE_URL) {
  console.error('FOUT: OYAA_TEST_BASE_URL is niet ingesteld. Gebruik bijv.:\n  OYAA_TEST_BASE_URL=https://chase.waybetter.nl node scripts/test-staging.mjs');
  process.exit(1);
}
const BASE_URL      = env.OYAA_TEST_BASE_URL.replace(/\/$/, '');
const TS_EMAIL      = env.OYAA_TEST_EMAIL ?? 'ruben@chase.amsterdam';
const SSE_TIMEOUT   = 90_000;

const CHASE_TENANT  = 'bcee1045-2006-4f1a-8a29-838eb2b6fca5';

// Nep-transcript voor recording-split tests (realistisch genoeg voor alle documenttypes)
const FAKE_TRANSCRIPT = `S1: Goedemorgen, bedankt voor je tijd vandaag. Ik ben Ruben van Chase.\n\nS2: Hoi Ruben. We willen graag een sampling-actie plannen voor onze nieuwe energydrank.\n\nS1: Perfect. Wanneer zou je dat willen?\n\nS2: Liefst tweede helft september. Budget is vijftienduizend euro inclusief materiaal.\n\nS1: En welke doelgroep?\n\nS2: Studenten en young professionals, achttien tot dertig jaar. Utrecht Centraal leek ons een goede locatie, maar we staan open voor alternatieven.\n\nS1: Ik denk ook aan Amsterdam Centraal en Den Haag Centraal. Ik check de beschikbaarheid.\n\nS2: Super. En kunnen we ook een BA inzetten? We willen zeven ambassadeurs voor twee dagen.\n\nS1: Dat organiseren we. Ik stuur jullie een briefing zodra alles vast staat.\n\nS2: Geweldig. En kunnen we de evaluatie daarna ook via jullie laten opstellen?\n\nS1: Ja, we evalueren altijd na afloop. Ik leg de resultaten vast in een rapport.`;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
const anon = createClient(SUPABASE_URL, ANON_KEY);

// ── Auth ─────────────────────────────────────────────────────────────────────

async function generateSession() {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink', email: TS_EMAIL,
  });
  if (linkErr) throw new Error('generateLink: ' + linkErr.message);

  const { data: sess, error: sessErr } = await anon.auth.verifyOtp({
    email: TS_EMAIL,
    token: link.properties.email_otp,
    type: 'email',
  });
  if (sessErr || !sess?.session) throw new Error('verifyOtp: ' + (sessErr?.message ?? 'geen sessie'));

  const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
  const cookieName = `sb-${ref}-auth-token`;
  const encoded = 'base64-' + Buffer.from(JSON.stringify(sess.session)).toString('base64url');
  const cookie = `${cookieName}=${encoded}`;
  const userId = sess.session.user.id;
  return { cookie, userId };
}

// ── SSE helper ───────────────────────────────────────────────────────────────

async function runSSE(cookie, body, tenantHostname) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), SSE_TIMEOUT);
  try {
    const reqHeaders = { 'Content-Type': 'application/json', 'Cookie': cookie };
    if (tenantHostname) reqHeaders['x-tenant-hostname'] = tenantHostname;
    const res = await fetch(`${BASE_URL}/api/chat-custom`, {
      method: 'POST', headers: reqHeaders, body: JSON.stringify(body), signal: ac.signal,
    });
    if (!res.ok) { clearTimeout(timer); return { httpStatus: res.status, events: [] }; }
    const events = [];
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop();
      for (const part of parts) {
        for (const line of part.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            events.push(ev);
            if (ev.type === 'done' || ev.type === 'error') break outer;
          } catch { /* ongeldige JSON */ }
        }
      }
    }
    clearTimeout(timer);
    return { httpStatus: 200, events };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') return { httpStatus: 0, events: [], timeout: true };
    return { httpStatus: 0, events: [], fetchError: err.message };
  }
}

// ── Test runner ──────────────────────────────────────────────────────────────

let totalPass = 0, totalFail = 0;
const allResults = [];

function pass(id, label) {
  console.log(`  ${id}: PASS ✓  ${label}`);
  totalPass++;
  allResults.push({ id, passed: true, label });
}

function fail(id, label, reasons) {
  console.log(`  ${id}: FAIL ✗  ${label}`);
  reasons.forEach(r => console.log(`       ✗ ${r}`));
  totalFail++;
  allResults.push({ id, passed: false, label, reasons });
}

// ── Cleanup tracker ──────────────────────────────────────────────────────────

const cleanupThreadIds = [];
const cleanupRecordingIds = [];

async function cleanup() {
  for (const id of cleanupThreadIds) {
    await sb.from('messages').delete().eq('thread_id', id);
    await sb.from('threads').delete().eq('id', id);
  }
  for (const id of cleanupRecordingIds) {
    await sb.from('recordings').delete().eq('id', id);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// TD — intent-detectie unit tests (geen server nodig)
// Repliceert de hasGenerateIntent-regex uit route.js.
// ────────────────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(60));
console.log('TD — intent-detectie (unit)');
console.log('='.repeat(60));

const hasGenerateIntent = (msg) =>
  /\b(maak|genereer)\b.{0,60}\b(briefing|document|samenvatting|evaluatie|rapport)\b|\b(maak\s+(de|hem|het|dit|haar))\b|\bdoe\s+het\s*(maar)?\b|\bbrief\w*\s+voor\s+\S/i
    .test(msg.split(/\n\n\[(?:Bijlage|Transcript):/)[0].trim());

const TD_TESTS = [
  // Fix vandaag: samenvatting en document waren niet gedekt
  { id: 'TD1', label: '"Maak een samenvatting" → hasGenerateIntent = true  [fix vandaag]',
    msg: 'Maak een samenvatting', expected: true },
  { id: 'TD2', label: '"Genereer een document" → hasGenerateIntent = true  [fix vandaag]',
    msg: 'Genereer een document', expected: true },
  { id: 'TD3', label: '"Maak een briefing naar PM" → hasGenerateIntent = true',
    msg: 'Maak een briefing naar PM', expected: true },
  { id: 'TD4', label: '"Maak een evaluatie" → hasGenerateIntent = true',
    msg: 'Maak een evaluatie', expected: true },
  { id: 'TD5', label: '"Doe het maar" → hasGenerateIntent = true',
    msg: 'Doe het maar', expected: true },
  { id: 'TD6', label: '"Wie was er aanwezig?" → hasGenerateIntent = false',
    msg: 'Wie was er aanwezig bij dit gesprek?', expected: false },
  { id: 'TD7', label: '"Wat zijn de actiepunten?" → hasGenerateIntent = false',
    msg: 'Wat zijn de actiepunten?', expected: false },
  { id: 'TD8', label: '"Vertaal dit naar Engels" → hasGenerateIntent = false',
    msg: 'Vertaal dit naar Engels', expected: false },
];

for (const t of TD_TESTS) {
  const result = hasGenerateIntent(t.msg);
  if (result === t.expected) pass(t.id, t.label);
  else fail(t.id, t.label, [`verwacht ${t.expected}, kreeg ${result}`]);
}

// ────────────────────────────────────────────────────────────────────────────
// Session + tenant ophalen
// ────────────────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(60));
console.log('Auth + tenant ophalen');
console.log('='.repeat(60));

let cookie, userId, tenantHostname;

try {
  process.stdout.write('  Sessie genereren... ');
  ({ cookie, userId } = await generateSession());
  console.log(`OK  (user: ${userId})`);
} catch (err) {
  console.log('FAIL — ' + err.message);
  console.log('\nKan niet verder zonder sessie. Controleer Supabase-keys en e-mail.');
  process.exit(1);
}

try {
  const { data: tenant } = await sb.from('tenants').select('hostname').eq('id', CHASE_TENANT).single();
  tenantHostname = tenant?.hostname ?? null;
  console.log(`  Tenant hostname: ${tenantHostname ?? '(geen)'}`);
} catch {
  console.log('  Tenant niet gevonden — tests gaan door zonder tenant-header.');
}

// ────────────────────────────────────────────────────────────────────────────
// TR — recordings + threads CRUD via HTTP
// ────────────────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(60));
console.log('TR — recordings + threads CRUD');
console.log('='.repeat(60));

// TR1: GET /api/recordings — lijst laadt
{
  const res = await fetch(`${BASE_URL}/api/recordings`, { headers: { Cookie: cookie } });
  if (res.ok) {
    const data = await res.json();
    if (Array.isArray(data))
      pass('TR1', `GET /api/recordings → 200, array (${data.length} items)`);
    else
      fail('TR1', 'GET /api/recordings', ['response is geen array: ' + JSON.stringify(data).slice(0, 80)]);
  } else {
    fail('TR1', 'GET /api/recordings', [`HTTP ${res.status}`]);
  }
}

// Maak test-recording aan via service client (geen echte audio nodig voor CRUD-tests)
let testRecId;
{
  const { data: rec, error } = await sb.from('recordings').insert({
    user_id: userId,
    tenant_id: CHASE_TENANT,
    storage_path: 'test/dummy.webm',
    audio_url: 'https://example.com/dummy.webm',
    duration_seconds: 42,
    client: 'Testklant',
    title: 'Testopname voor CRUD',
    transcript_status: 'done',
  }).select('id').single();

  if (error || !rec) {
    fail('TR-setup', 'Testopname aanmaken', [error?.message ?? 'geen data terug']);
  } else {
    testRecId = rec.id;
    cleanupRecordingIds.push(testRecId);
    console.log(`  Test-recording aangemaakt: ${testRecId}`);
  }
}

// TR2: PATCH /api/recordings/[id] — hernoemen
if (testRecId) {
  const res = await fetch(`${BASE_URL}/api/recordings/${testRecId}`, {
    method: 'PATCH',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Hernoemde testopname' }),
  });
  if (res.ok) {
    const { data: rec } = await sb.from('recordings').select('title').eq('id', testRecId).single();
    if (rec?.title === 'Hernoemde testopname')
      pass('TR2', 'PATCH /api/recordings/[id] → 200, titel bijgewerkt in DB');
    else
      fail('TR2', 'PATCH /api/recordings/[id]', [`titel in DB is "${rec?.title}" ipv "Hernoemde testopname"`]);
  } else {
    fail('TR2', 'PATCH /api/recordings/[id]', [`HTTP ${res.status}`]);
  }
}

// TR3: POST /api/recordings/[id]/start-thread — thread aangemaakt met recording_id
let startedThreadId;
if (testRecId) {
  const res = await fetch(`${BASE_URL}/api/recordings/${testRecId}/start-thread`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  if (res.ok) {
    const body = await res.json();
    if (body.threadId) {
      startedThreadId = body.threadId;
      cleanupThreadIds.push(startedThreadId);
      // Controleer thread in DB
      const { data: thread } = await sb.from('threads').select('output_type, recording_id').eq('id', startedThreadId).single();
      const errors = [];
      if (thread?.output_type !== 'recording') errors.push(`output_type is "${thread?.output_type}" ipv "recording"`);
      if (thread?.recording_id !== testRecId)  errors.push(`recording_id is "${thread?.recording_id}" ipv "${testRecId}"`);
      if (errors.length === 0) pass('TR3', 'POST /start-thread → threadId terug, output_type=recording, recording_id correct');
      else fail('TR3', 'POST /start-thread', errors);
    } else {
      fail('TR3', 'POST /start-thread', ['geen threadId in response: ' + JSON.stringify(body)]);
    }
  } else {
    fail('TR3', 'POST /start-thread', [`HTTP ${res.status}`]);
  }
}

// TR4: GET /api/recordings na start-thread — thread_id staat nu op de recording
if (testRecId && startedThreadId) {
  const res = await fetch(`${BASE_URL}/api/recordings`, { headers: { Cookie: cookie } });
  if (res.ok) {
    const data = await res.json();
    const rec = data.find(r => r.id === testRecId);
    if (rec?.thread_id === startedThreadId)
      pass('TR4', 'GET /api/recordings toont thread_id op de recording na start-thread');
    else
      fail('TR4', 'GET /api/recordings', [`thread_id is "${rec?.thread_id}" ipv "${startedThreadId}"`]);
  } else {
    fail('TR4', 'GET /api/recordings', [`HTTP ${res.status}`]);
  }
}

// TR5: DELETE thread → recording blijft, thread.recording_id is null (FK ON DELETE SET NULL)
if (startedThreadId && testRecId) {
  const delRes = await fetch(`${BASE_URL}/api/threads/${startedThreadId}`, {
    method: 'DELETE',
    headers: { Cookie: cookie },
  });
  if (delRes.ok) {
    // Thread weg?
    const { data: thread } = await sb.from('threads').select('id').eq('id', startedThreadId).single();
    // Recording nog aanwezig?
    const { data: rec } = await sb.from('recordings').select('id').eq('id', testRecId).single();
    const errors = [];
    if (thread) errors.push('thread bestaat nog in DB na DELETE');
    if (!rec)   errors.push('recording verdwenen na thread-DELETE (cascade verkeerd)');
    if (errors.length === 0) {
      pass('TR5', 'DELETE /api/threads/[id] → thread weg, recording intact (FK ON DELETE SET NULL)');
      cleanupThreadIds.splice(cleanupThreadIds.indexOf(startedThreadId), 1); // al verwijderd
    } else {
      fail('TR5', 'DELETE /api/threads/[id]', errors);
    }
  } else {
    fail('TR5', 'DELETE /api/threads/[id]', [`HTTP ${delRes.status}`]);
  }
}

// TR6: DELETE /api/recordings/[id] → recording weg, geen cascade op threads
// Maak een extra thread met recording_id → verwijder recording → thread.recording_id = null
let extraThreadId;
if (testRecId) {
  const { data: t } = await sb.from('threads').insert({
    user_id: userId, tenant_id: CHASE_TENANT,
    title: 'Test thread voor FK-check', output_type: 'recording',
    recording_id: testRecId,
  }).select('id').single();
  if (t) {
    extraThreadId = t.id;
    cleanupThreadIds.push(extraThreadId);
    const delRes = await fetch(`${BASE_URL}/api/recordings/${testRecId}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });
    if (delRes.ok) {
      const { data: rec } = await sb.from('recordings').select('id').eq('id', testRecId).single();
      const { data: thread } = await sb.from('threads').select('recording_id').eq('id', extraThreadId).single();
      const errors = [];
      if (rec)                            errors.push('recording bestaat nog na DELETE');
      if (thread?.recording_id !== null)  errors.push(`thread.recording_id is "${thread?.recording_id}" ipv null`);
      if (errors.length === 0) {
        pass('TR6', 'DELETE /api/recordings/[id] → recording weg, thread.recording_id = null (FK set null)');
        cleanupRecordingIds.splice(cleanupRecordingIds.indexOf(testRecId), 1); // al weg
        testRecId = null;
      } else {
        fail('TR6', 'DELETE /api/recordings/[id]', errors);
      }
    } else {
      fail('TR6', 'DELETE /api/recordings/[id]', [`HTTP ${delRes.status}`]);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Hulpfunctie: maak een document-thread aan voor SSE-tests
// ────────────────────────────────────────────────────────────────────────────

async function makeThread(outputType, client = 'Testklant SSE') {
  const { data: t } = await sb.from('threads').insert({
    user_id: userId, tenant_id: CHASE_TENANT,
    title: `Testthread ${outputType}`, output_type: outputType, client,
  }).select('id').single();
  if (!t) throw new Error(`Kan geen thread aanmaken voor ${outputType}`);
  cleanupThreadIds.push(t.id);
  return t.id;
}

// ────────────────────────────────────────────────────────────────────────────
// SSE check helpers
// ────────────────────────────────────────────────────────────────────────────

function checkSSE(events, { minLength = 300, mustContain = [], mustNotContain = [], expectDoc = true } = {}) {
  const failures = [];
  const doneEvent = events.find(e => e.type === 'done');
  const metaEvent = events.find(e => e.type === 'meta');
  if (!doneEvent)              failures.push('geen done-event ontvangen');
  if (doneEvent && !doneEvent.content)   failures.push('done.content ontbreekt');
  if (doneEvent && !doneEvent.messageId) failures.push('done.messageId ontbreekt');
  const content = String(doneEvent?.content ?? '');
  if (expectDoc && content.length < minLength)
    failures.push(`content te kort voor document: ${content.length} tekens (min ${minLength})`);
  // Gebruik meta.isDocument als gezaghebbende check voor document vs. vrij antwoord
  if (!expectDoc && metaEvent?.isDocument === true)
    failures.push(`meta.isDocument=true maar verwacht geen document — route behandelt dit als documentgeneratie`);
  for (const re of mustContain) {
    if (!re.test(content)) failures.push(`ontbreekt in antwoord: ${re}`);
  }
  for (const re of mustNotContain) {
    if (re.test(content)) failures.push(`mag niet in antwoord: ${re}`);
  }
  return { failures, content: content.slice(0, 150) };
}

// ────────────────────────────────────────────────────────────────────────────
// TC — Chase documenttypes via recording-split (knop-pad: outputType expliciet)
// ────────────────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(60));
console.log('TC — Chase documentgeneratie vanuit transcript');
console.log('='.repeat(60));

const CHASE_DOC_TYPES = [
  { id: 'TC1', type: 'meeting-summary',     label: 'Samenvatting  [fix vandaag]', mustContain: [/student|budget|energie|ambassador|ruben/i] },
  { id: 'TC2', type: 'account-to-pm',       label: 'Briefing naar PM',            mustContain: [] },
  { id: 'TC3', type: 'field-briefing',      label: 'Briefing naar BA',            mustContain: [] },
  { id: 'TC4', type: 'account-to-creation', label: 'Briefing naar Creatie',       mustContain: [] },
  { id: 'TC5', type: 'evaluation',          label: 'Evaluatie',                   mustContain: [] },
];

for (const test of CHASE_DOC_TYPES) {
  let threadId;
  try { threadId = await makeThread(test.type); } catch (e) {
    fail(test.id, test.label, ['thread aanmaken mislukt: ' + e.message]);
    continue;
  }
  const { events, timeout, fetchError, httpStatus } = await runSSE(cookie, {
    threadId,
    message: 'Maak het document',
    outputType: test.type,
    recordingTranscript: FAKE_TRANSCRIPT,
  }, tenantHostname);

  if (timeout) { fail(test.id, test.label, [`TIMEOUT na ${SSE_TIMEOUT / 1000}s`]); continue; }
  if (fetchError) { fail(test.id, test.label, [fetchError]); continue; }
  if (httpStatus !== 200) { fail(test.id, test.label, [`HTTP ${httpStatus}`]); continue; }

  const { failures, content } = checkSSE(events, { mustContain: test.mustContain });
  if (failures.length === 0) pass(test.id, test.label);
  else {
    fail(test.id, test.label, failures);
    console.log(`    → preview: "${content.replace(/\n/g, ' ')}"`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// TDB — documentgeneratie via DB-lookup (geen recordingTranscript, wel recordingThreadId)
// Simuleert het directe pad na een opname: recording aangemaakt, transcript in DB
// opgeslagen, direct document genereren zonder de thread opnieuw te laden.
// In de browser was messagesRef stale → recordingTranscript null, server moet
// transcript zelf ophalen via recordingThreadId.
// Dekt alle Chase-documenttypes (5) en All Day-types (2).
// ────────────────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(60));
console.log('TDB — DB-fallback: alle documenttypes, geen recordingTranscript');
console.log('='.repeat(60));

// mustContain: alleen voor meeting-summary controleren we of het transcript zichtbaar is
// in de output — andere types gebruiken eigen templates die het transcript anders verwerken.
// mustNotContain: de exacte frase die de server teruggeeft bij isEmptyDocumentRequest.
const TDB_DOC_TYPES = [
  { id: 'TDB1', type: 'meeting-summary',        label: 'Samenvatting',            client: 'Testklant SSE',      mustContain: [/student|budget|energie|ambassador|ruben/i] },
  { id: 'TDB2', type: 'account-to-pm',          label: 'Briefing naar PM',        client: 'Testklant SSE',      mustContain: [] },
  { id: 'TDB3', type: 'field-briefing',         label: 'Briefing naar BA',        client: 'Testklant SSE',      mustContain: [] },
  { id: 'TDB4', type: 'account-to-creation',    label: 'Briefing naar Creatie',   client: 'Testklant SSE',      mustContain: [] },
  { id: 'TDB5', type: 'evaluation',             label: 'Evaluatie',               client: 'Testklant SSE',      mustContain: [] },
  { id: 'TDB6', type: 'allday-gespreksverslag', label: 'All Day Gespreksverslag', client: 'Testklant All Day',  mustContain: [] },
  { id: 'TDB7', type: 'allday-debrief',         label: 'All Day Debrief',         client: 'Testklant All Day',  mustContain: [] },
];

for (const test of TDB_DOC_TYPES) {
  let threadId;
  try {
    // Simuleert: opname net klaar, thread aangemaakt, transcript opgeslagen in DB
    const { data: t, error: tErr } = await sb.from('threads').insert({
      user_id: userId, tenant_id: CHASE_TENANT,
      title: `Testthread ${test.id} recording`, output_type: 'recording', client: test.client,
    }).select('id').single();
    if (tErr || !t) throw new Error(tErr?.message ?? 'geen thread-id terug');
    threadId = t.id;
    cleanupThreadIds.push(threadId);

    const { error: mErr } = await sb.from('messages').insert({
      thread_id: threadId, role: 'user', content: FAKE_TRANSCRIPT,
    });
    if (mErr) throw new Error('bericht invoegen mislukt: ' + mErr.message);
  } catch (e) {
    fail(test.id, `DB-fallback ${test.label} → document met inhoud`, ['setup mislukt: ' + e.message]);
    continue;
  }

  // Stuur géén recordingTranscript mee — server moet het zelf uit DB halen via recordingThreadId
  const { events, timeout, fetchError, httpStatus } = await runSSE(cookie, {
    threadId,
    message: `Maak een ${test.label.toLowerCase()} van dit transcript`,
    outputType: test.type,
    recordingThreadId: threadId,
    // recordingTranscript bewust weggelaten — simuleert browser direct na opname
  }, tenantHostname);

  if (timeout) {
    fail(test.id, `DB-fallback ${test.label} → document gegenereerd`, [`TIMEOUT na ${SSE_TIMEOUT / 1000}s`]);
  } else if (fetchError) {
    fail(test.id, `DB-fallback ${test.label} → document gegenereerd`, [fetchError]);
  } else if (httpStatus !== 200) {
    fail(test.id, `DB-fallback ${test.label} → document gegenereerd`, [`HTTP ${httpStatus}`]);
  } else {
    // Primaire check: server vraagt NIET om input (= DB-fallback werkte)
    // Alleen voor meeting-summary controleren we of transcriptinhoud zichtbaar is
    const { failures, content } = checkSSE(events, {
      mustContain: test.mustContain,
      mustNotContain: [/\bwat is de input\b|\bwat.*input.*voor.*dit\b/i],
    });
    if (failures.length === 0) pass(test.id, `DB-fallback ${test.label} → document gegenereerd`);
    else {
      fail(test.id, `DB-fallback ${test.label} → document gegenereerd`, failures);
      console.log(`    → preview: "${content.replace(/\n/g, ' ')}"`);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// TI — Intent via intypen: "Maak een samenvatting" in recording-thread
// ────────────────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(60));
console.log('TI — intent-detectie via intypen  [fix vandaag]');
console.log('='.repeat(60));

const INTYPE_TESTS = [
  { id: 'TI1', label: '"Maak een samenvatting" → document gegenereerd',
    message: 'Maak een samenvatting',
    // Elk item test een concreet gedragspatroon: het systeem vraagt om verduidelijking
    // in plaats van direct te genereren. Losse inhoudswoorden (campagne, input) zijn
    // bewust weggelaten — die staan ook in gegenereerde document-body's.
    mustNotContain: [
      /voor welke campagne\?|welke campagne wil/i,  // vraagt om campagnekeuze
      /plak.*transcript/i,                           // vraagt om transcript
      /wat.*wil.*je.{0,30}\?/i,                     // vraagt wat te genereren
      /geen.*input|geef.*input\b/i,                 // klaagt over ontbrekende input
    ],
  },
  { id: 'TI2', label: '"Maak een document" → document gegenereerd',
    message: 'Maak een document',
    mustNotContain: [
      /voor welke campagne\?|welke campagne wil/i,
      /plak.*transcript/i,
      /wat.*wil.*je.{0,30}\?/i,
      /geen.*input|geef.*input\b/i,
    ],
  },
];

for (const test of INTYPE_TESTS) {
  let threadId;
  try { threadId = await makeThread('recording'); } catch (e) {
    fail(test.id, test.label, ['thread aanmaken mislukt: ' + e.message]);
    continue;
  }
  const { events, timeout, fetchError, httpStatus } = await runSSE(cookie, {
    threadId,
    message: test.message,
    outputType: 'recording',
    recordingTranscript: FAKE_TRANSCRIPT,
  }, tenantHostname);

  if (timeout) { fail(test.id, test.label, [`TIMEOUT na ${SSE_TIMEOUT / 1000}s`]); continue; }
  if (fetchError) { fail(test.id, test.label, [fetchError]); continue; }
  if (httpStatus !== 200) { fail(test.id, test.label, [`HTTP ${httpStatus}`]); continue; }

  const { failures, content } = checkSSE(events, { minLength: 200, mustNotContain: test.mustNotContain });
  if (failures.length === 0) pass(test.id, test.label);
  else {
    fail(test.id, test.label, failures);
    console.log(`    → preview: "${content.replace(/\n/g, ' ')}"`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// TQ — Vragen over transcript: GEEN document gegenereerd
// ────────────────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(60));
console.log('TQ — vragen stellen over transcript (geen document)');
console.log('='.repeat(60));

const QUESTION_TESTS = [
  { id: 'TQ1', label: '"Wie was er aanwezig?" → vrij antwoord, geen document',
    message: 'Wie was er aanwezig bij dit gesprek?',
  },
  { id: 'TQ2', label: '"Wat zijn de actiepunten?" → vrij antwoord, geen document',
    message: 'Wat zijn de actiepunten uit dit gesprek?',
  },
];

for (const test of QUESTION_TESTS) {
  let threadId;
  try { threadId = await makeThread('recording'); } catch (e) {
    fail(test.id, test.label, ['thread aanmaken mislukt: ' + e.message]);
    continue;
  }
  const { events, timeout, fetchError, httpStatus } = await runSSE(cookie, {
    threadId,
    message: test.message,
    outputType: 'recording',
    recordingTranscript: FAKE_TRANSCRIPT,
  }, tenantHostname);

  if (timeout) { fail(test.id, test.label, [`TIMEOUT na ${SSE_TIMEOUT / 1000}s`]); continue; }
  if (fetchError) { fail(test.id, test.label, [fetchError]); continue; }
  if (httpStatus !== 200) { fail(test.id, test.label, [`HTTP ${httpStatus}`]); continue; }

  // Vragen mogen korter zijn (geen formeel document) en mogen niet te lang zijn
  const { failures, content } = checkSSE(events, {
    expectDoc: false,
    minLength: 0,
    mustContain: [],
  });
  if (failures.length === 0) pass(test.id, test.label);
  else {
    fail(test.id, test.label, failures);
    console.log(`    → preview: "${content.replace(/\n/g, ' ')}"`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// TF — Vrij gesprek zonder audio of document-intentie
// ────────────────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(60));
console.log('TF — vrij gesprek zonder audio');
console.log('='.repeat(60));

{
  let threadId;
  try { threadId = await makeThread(null, 'Testklant vrij chat'); } catch (e) {
    fail('TF1', 'Vrij gesprek', ['thread aanmaken mislukt: ' + e.message]);
  }

  if (threadId) {
    const { events, timeout, fetchError, httpStatus } = await runSSE(cookie, {
      threadId,
      message: 'Vertaal dit naar het Engels: Goedemorgen wereld.',
      outputType: null,
    }, tenantHostname);

    if (timeout) { fail('TF1', 'Vrij gesprek', [`TIMEOUT na ${SSE_TIMEOUT / 1000}s`]); }
    else if (fetchError) { fail('TF1', 'Vrij gesprek', [fetchError]); }
    else if (httpStatus !== 200) { fail('TF1', 'Vrij gesprek', [`HTTP ${httpStatus}`]); }
    else {
      const { failures, content } = checkSSE(events, {
        expectDoc: false,
        minLength: 0,
        mustContain: [/good morning world|morning/i],
        mustNotContain: [/\[UITZOEKEN\]/i],
      });
      if (failures.length === 0) pass('TF1', 'Vrij gesprek → vertaling correct, geen document');
      else {
        fail('TF1', 'Vrij gesprek', failures);
        console.log(`    → preview: "${content.replace(/\n/g, ' ')}"`);
      }
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// TA — All Day documenttypes
// ────────────────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(60));
console.log('TA — All Day documenttypes');
console.log('='.repeat(60));

const ALLDAY_TESTS = [
  { id: 'TA1', type: 'allday-gespreksverslag', label: 'Gespreksverslag' },
  { id: 'TA2', type: 'allday-debrief',         label: 'Debrief' },
];

for (const test of ALLDAY_TESTS) {
  let threadId;
  try { threadId = await makeThread(test.type, 'Testklant All Day'); } catch (e) {
    fail(test.id, test.label, ['thread aanmaken mislukt: ' + e.message]);
    continue;
  }
  const { events, timeout, fetchError, httpStatus } = await runSSE(cookie, {
    threadId,
    message: 'Maak het document',
    outputType: test.type,
    recordingTranscript: FAKE_TRANSCRIPT,
  }, tenantHostname);

  if (timeout) { fail(test.id, test.label, [`TIMEOUT na ${SSE_TIMEOUT / 1000}s`]); continue; }
  if (fetchError) { fail(test.id, test.label, [fetchError]); continue; }
  if (httpStatus !== 200) { fail(test.id, test.label, [`HTTP ${httpStatus}`]); continue; }

  const { failures, content } = checkSSE(events, { minLength: 200 });
  if (failures.length === 0) pass(test.id, test.label);
  else {
    fail(test.id, test.label, failures);
    console.log(`    → preview: "${content.replace(/\n/g, ' ')}"`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// TSO — Volgordescenario's: exacte client-payload zoals nieuwe code die stuurt
//
// Scenario 1/3 (direct na opname, of na wegnavigeren en terugkeren):
//   threadId: null, recordingThreadId: <rec>, recordingTranscript: FAKE
//   → server maakt nieuw document-thread, gebruikt transcript direct
//
// Scenario 2 (na eerder gegenereerd document, messagesRef stale):
//   threadId: null, recordingThreadId: <rec>, recordingTranscript: null
//   → server maakt nieuw document-thread, haalt transcript op via recordingThreadId
//
// Scenario 3-fout (oud foutpad dat nu expliciete fout moet geven):
//   threadId: <doc-thread>, recordingThreadId: null, message: "...van dit transcript"
//   → server stuurt error-event, geen "Wat is de input?"
// ────────────────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(60));
console.log('TSO — Volgordescenario 1/3: transcript meegestuurd (threadId=null)');
console.log('='.repeat(60));

const TSO_ALL_TYPES = [
  { id: 'TSO1',  type: 'meeting-summary',        label: 'Samenvatting',            client: 'Testklant SSE',     mustContain: [/student|budget|energie|ambassador|ruben/i] },
  { id: 'TSO2',  type: 'account-to-pm',          label: 'Briefing naar PM',        client: 'Testklant SSE',     mustContain: [] },
  { id: 'TSO3',  type: 'field-briefing',         label: 'Briefing naar BA',        client: 'Testklant SSE',     mustContain: [] },
  { id: 'TSO4',  type: 'account-to-creation',    label: 'Briefing naar Creatie',   client: 'Testklant SSE',     mustContain: [] },
  { id: 'TSO5',  type: 'evaluation',             label: 'Evaluatie',               client: 'Testklant SSE',     mustContain: [] },
  { id: 'TSO6',  type: 'allday-gespreksverslag', label: 'All Day Gespreksverslag', client: 'Testklant All Day', mustContain: [] },
  { id: 'TSO7',  type: 'allday-debrief',         label: 'All Day Debrief',         client: 'Testklant All Day', mustContain: [] },
];

for (const test of TSO_ALL_TYPES) {
  // Simuleert exact de nieuwe client-payload: threadId=null, recordingThreadId + transcript
  let recThreadId;
  try {
    const { data: t, error: tErr } = await sb.from('threads').insert({
      user_id: userId, tenant_id: CHASE_TENANT,
      title: `TSO recording ${test.id}`, output_type: 'recording', client: test.client,
    }).select('id').single();
    if (tErr || !t) throw new Error(tErr?.message ?? 'geen id');
    recThreadId = t.id;
    cleanupThreadIds.push(recThreadId);
  } catch (e) {
    fail(test.id, `Scenario 1 ${test.label} (met transcript)`, ['setup mislukt: ' + e.message]);
    continue;
  }

  const { events, timeout, fetchError, httpStatus } = await runSSE(cookie, {
    threadId: null,
    message: `Maak een ${test.label.toLowerCase()} van dit transcript`,
    outputType: test.type,
    recordingThreadId: recThreadId,
    recordingTranscript: FAKE_TRANSCRIPT,
    recordingClient: test.client,
  }, tenantHostname);

  if (timeout) { fail(test.id, `Scenario 1 ${test.label} (met transcript)`, [`TIMEOUT na ${SSE_TIMEOUT / 1000}s`]); continue; }
  if (fetchError) { fail(test.id, `Scenario 1 ${test.label} (met transcript)`, [fetchError]); continue; }
  if (httpStatus !== 200) { fail(test.id, `Scenario 1 ${test.label} (met transcript)`, [`HTTP ${httpStatus}`]); continue; }

  const newThreadEvent = events.find(e => e.type === 'meta' && e.threadId);
  if (newThreadEvent?.threadId) cleanupThreadIds.push(newThreadEvent.threadId);

  const { failures, content } = checkSSE(events, {
    mustContain: test.mustContain,
    mustNotContain: [/\bwat is de input\b|\bwat.*input.*voor.*dit\b/i, /transcript niet gevonden/i],
  });
  if (failures.length === 0) pass(test.id, `Scenario 1 ${test.label} → document gegenereerd`);
  else {
    fail(test.id, `Scenario 1 ${test.label} (met transcript)`, failures);
    console.log(`    → preview: "${content.replace(/\n/g, ' ')}"`);
  }
}

console.log('\n' + '='.repeat(60));
console.log('TSO — Volgordescenario 2: geen transcript, DB-fallback (threadId=null)');
console.log('='.repeat(60));

const TSODB_ALL_TYPES = [
  { id: 'TSODB1', type: 'meeting-summary',        label: 'Samenvatting',            client: 'Testklant SSE',     mustContain: [/student|budget|energie|ambassador|ruben/i] },
  { id: 'TSODB2', type: 'account-to-pm',          label: 'Briefing naar PM',        client: 'Testklant SSE',     mustContain: [] },
  { id: 'TSODB3', type: 'field-briefing',         label: 'Briefing naar BA',        client: 'Testklant SSE',     mustContain: [] },
  { id: 'TSODB4', type: 'account-to-creation',    label: 'Briefing naar Creatie',   client: 'Testklant SSE',     mustContain: [] },
  { id: 'TSODB5', type: 'evaluation',             label: 'Evaluatie',               client: 'Testklant SSE',     mustContain: [] },
  { id: 'TSODB6', type: 'allday-gespreksverslag', label: 'All Day Gespreksverslag', client: 'Testklant All Day', mustContain: [] },
  { id: 'TSODB7', type: 'allday-debrief',         label: 'All Day Debrief',         client: 'Testklant All Day', mustContain: [] },
];

for (const test of TSODB_ALL_TYPES) {
  // Simuleert na eerder gegenereerd document: threadId=null, recordingThreadId bekend,
  // maar recordingTranscript null (messagesRef was stale). Server haalt transcript uit DB.
  let recThreadId;
  try {
    const { data: t, error: tErr } = await sb.from('threads').insert({
      user_id: userId, tenant_id: CHASE_TENANT,
      title: `TSODB recording ${test.id}`, output_type: 'recording', client: test.client,
    }).select('id').single();
    if (tErr || !t) throw new Error(tErr?.message ?? 'geen id');
    recThreadId = t.id;
    cleanupThreadIds.push(recThreadId);
    const { error: mErr } = await sb.from('messages').insert({
      thread_id: recThreadId, role: 'user', content: FAKE_TRANSCRIPT,
    });
    if (mErr) throw new Error('bericht invoegen mislukt: ' + mErr.message);
  } catch (e) {
    fail(test.id, `Scenario 2 ${test.label} (DB-fallback)`, ['setup mislukt: ' + e.message]);
    continue;
  }

  const { events, timeout, fetchError, httpStatus } = await runSSE(cookie, {
    threadId: null,
    message: `Maak een ${test.label.toLowerCase()} van dit transcript`,
    outputType: test.type,
    recordingThreadId: recThreadId,
    recordingClient: test.client,
    // recordingTranscript bewust weggelaten — simuleert stale messagesRef
  }, tenantHostname);

  if (timeout) { fail(test.id, `Scenario 2 ${test.label} (DB-fallback)`, [`TIMEOUT na ${SSE_TIMEOUT / 1000}s`]); continue; }
  if (fetchError) { fail(test.id, `Scenario 2 ${test.label} (DB-fallback)`, [fetchError]); continue; }
  if (httpStatus !== 200) { fail(test.id, `Scenario 2 ${test.label} (DB-fallback)`, [`HTTP ${httpStatus}`]); continue; }

  const newThreadEvDB = events.find(e => e.type === 'meta' && e.threadId);
  if (newThreadEvDB?.threadId) cleanupThreadIds.push(newThreadEvDB.threadId);

  const { failures, content } = checkSSE(events, {
    mustContain: test.mustContain,
    mustNotContain: [/\bwat is de input\b|\bwat.*input.*voor.*dit\b/i, /transcript niet gevonden/i],
  });
  if (failures.length === 0) pass(test.id, `Scenario 2 ${test.label} → DB-fallback, document gegenereerd`);
  else {
    fail(test.id, `Scenario 2 ${test.label} (DB-fallback)`, failures);
    console.log(`    → preview: "${content.replace(/\n/g, ' ')}"`);
  }
}

console.log('\n' + '='.repeat(60));
console.log('TSO — Volgordescenario 3-fout: ontbrekende context → expliciete fout');
console.log('='.repeat(60));

// Simuleert het oude foutpad: threadId is een document-thread, geen recordingThreadId,
// geen transcript — maar bericht bevat "van dit transcript".
// Verwacht: server geeft error-event, geen "Wat is de input?".
{
  let docThreadId;
  try {
    const { data: t } = await sb.from('threads').insert({
      user_id: userId, tenant_id: CHASE_TENANT,
      title: 'Foutpad test document-thread', output_type: 'account-to-pm', client: 'Testklant SSE',
    }).select('id').single();
    docThreadId = t?.id;
    if (docThreadId) cleanupThreadIds.push(docThreadId);
  } catch { /* mislukt — test hieronder faalt dan op httpStatus */ }

  const { events, timeout, fetchError, httpStatus } = await runSSE(cookie, {
    threadId: docThreadId ?? null,
    message: 'Maak een samenvatting van dit transcript',
    outputType: 'meeting-summary',
    // geen recordingThreadId, geen recordingTranscript — het oude foutpad
  }, tenantHostname);

  if (timeout) {
    fail('TSOERR1', 'Foutpad → expliciete fout, geen "Wat is de input?"', [`TIMEOUT na ${SSE_TIMEOUT / 1000}s`]);
  } else if (fetchError) {
    fail('TSOERR1', 'Foutpad → expliciete fout, geen "Wat is de input?"', [fetchError]);
  } else if (httpStatus !== 200) {
    fail('TSOERR1', 'Foutpad → expliciete fout, geen "Wat is de input?"', [`HTTP ${httpStatus}`]);
  } else {
    const errorEvent = events.find(e => e.type === 'error');
    const doneEvent  = events.find(e => e.type === 'done');
    const content    = String(doneEvent?.content ?? '');
    const errors = [];
    if (!errorEvent && !/transcript niet gevonden/i.test(content)) {
      // Server had ofwel een error-event of foutmelding in content moeten sturen
      if (/wat is de input|wat.*input.*voor.*dit/i.test(content)) {
        errors.push('server antwoordde met "Wat is de input?" in plaats van een fout');
      } else {
        errors.push(`geen error-event en geen foutmelding in content: "${content.slice(0, 80)}"`);
      }
    }
    if (errors.length === 0) pass('TSOERR1', 'Foutpad → expliciete fout, geen "Wat is de input?"');
    else fail('TSOERR1', 'Foutpad → expliciete fout, geen "Wat is de input?"', errors);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// TU — Upload-thread: bestandsupload route (request-upload endpoint)
// ────────────────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(60));
console.log('TU — Upload-thread: bestandsupload route');
console.log('='.repeat(60));

{
  // TU1: /api/recordings/request-upload geeft een signed URL terug
  let tu1Passed = false;
  try {
    const res = await fetch(`${BASE_URL}/api/recordings/request-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({ ext: 'm4a' }),
    });
    if (res.status !== 200) {
      fail('TU1', '/api/recordings/request-upload → signed URL', [`HTTP ${res.status}`]);
    } else {
      const data = await res.json();
      const errors = [];
      if (!data.signedUrl || typeof data.signedUrl !== 'string') errors.push('signedUrl ontbreekt of is geen string');
      if (!data.path || typeof data.path !== 'string') errors.push('path ontbreekt of is geen string');
      if (!data.signedUrl?.startsWith('https://')) errors.push('signedUrl begint niet met https://');
      if (errors.length === 0) {
        pass('TU1', '/api/recordings/request-upload → signed URL + path ontvangen');
        tu1Passed = true;
      } else {
        fail('TU1', '/api/recordings/request-upload → signed URL', errors);
      }
    }
  } catch (e) {
    fail('TU1', '/api/recordings/request-upload → signed URL', [e.message]);
  }

  // TU2: thread met output_type=recording + audio_url (upload-pad simulatie) genereert document
  // Maakt direct een thread aan zoals create-recording-thread dat doet, inclusief audio_url.
  // Verifieert dat de documentgeneratie correct werkt voor upload-gecreëerde threads.
  {
    const { data: tuThread, error: tuThreadErr } = await sb.from('threads').insert({
      user_id: userId,
      tenant_id: CHASE_TENANT,
      title: 'TU2 upload-simulatie',
      output_type: 'recording',
      audio_url: 'https://example.com/fake-audio.m4a',
      transcript_status: 'done',
    }).select('id').single();

    if (tuThreadErr || !tuThread) {
      fail('TU2', 'Upload-thread documentgeneratie → thread aanmaken mislukt', [tuThreadErr?.message ?? 'geen data']);
    } else {
      cleanupThreadIds.push(tuThread.id);
      await sb.from('messages').insert({ thread_id: tuThread.id, role: 'user', content: FAKE_TRANSCRIPT });

      const { httpStatus, events, timeout, fetchError } = await runSSE(cookie,
        {
          message: `Maak een samenvatting van dit transcript`,
          outputType: 'samenvatting',
          outputTypeLabel: 'Samenvatting',
          outputTypeLabelHeader: 'Samenvatting',
          clientName: null,
          threadId: null,
          recordingThreadId: tuThread.id,
          recordingTranscript: FAKE_TRANSCRIPT,
        },
        'chase-staging.waybetter.nl',
      );

      if (timeout) fail('TU2', 'Upload-thread documentgeneratie → Samenvatting', [`TIMEOUT na ${SSE_TIMEOUT / 1000}s`]);
      else if (fetchError) fail('TU2', 'Upload-thread documentgeneratie → Samenvatting', [fetchError]);
      else if (httpStatus !== 200) fail('TU2', 'Upload-thread documentgeneratie → Samenvatting', [`HTTP ${httpStatus}`]);
      else {
        const { failures, content } = checkSSE(events, {
          expectDocument: true, expectDone: true, expectError: false,
        });
        if (failures.length === 0) pass('TU2', 'Upload-thread (audio_url aanwezig) → Samenvatting gegenereerd');
        else fail('TU2', 'Upload-thread documentgeneratie → Samenvatting', failures);
      }
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Cleanup
// ────────────────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(60));
console.log('Cleanup');
console.log('='.repeat(60));

try {
  await cleanup();
  console.log(`  ${cleanupThreadIds.length + cleanupRecordingIds.length === 0 ? 'Niets te verwijderen.' : 'Test-data opgeruimd.'}`);
} catch (e) {
  console.log('  (cleanup-fout: ' + e.message + ')');
}

// ────────────────────────────────────────────────────────────────────────────
// Samenvatting
// ────────────────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(60));
console.log('SAMENVATTING');
console.log('='.repeat(60));

const failedTests = allResults.filter(r => !r.passed);
const passedTests = allResults.filter(r => r.passed);
console.log(`\nGeslaagd: ${passedTests.length}/${allResults.length}`);
console.log(`Gefaald:  ${failedTests.length}/${allResults.length}`);

if (failedTests.length > 0) {
  console.log('\nGefaalde tests:');
  for (const t of failedTests) {
    console.log(`  ✗ ${t.id} — ${t.label}`);
    t.reasons?.forEach(r => console.log(`       ${r}`));
  }
}

console.log('\n' + '='.repeat(60));
console.log('Wat je zelf moet controleren (niet via HTTP testbaar):');
console.log('='.repeat(60));
console.log(`
  M1  Microfoon-opname starten via de browser (permissie, upload, wachten op transcript)
  M2  Audio-speler in de recording-thread: afspelen, pauzeren, scrubben
  M3  Speechmatics webhook: verifieer in Vercel-logs dat /api/transcription-callback
      aangeroepen wordt en transcript_status overgaat naar "done"
  M4  Transcript-polling: open een recording-thread op status "processing" en wacht
      tot het transcript automatisch verschijnt zonder herladen
  M5  Fase-picker All Day: klik "Gespreksverslag" in de UI, kies een fase, check document
`);

process.exit(failedTests.length > 0 ? 1 : 0);
