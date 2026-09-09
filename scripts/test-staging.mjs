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
// Dekt de browser-bug: messagesRef stale → transcript niet meegestuurd,
// server zoekt het op via recordingThreadId uit de DB.
// ────────────────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(60));
console.log('TDB — DB-fallback: transcript ophalen zonder recordingTranscript');
console.log('='.repeat(60));

{
  let threadId;
  try {
    const { data: t, error: tErr } = await sb.from('threads').insert({
      user_id: userId, tenant_id: CHASE_TENANT,
      title: 'Testthread TDB1 recording', output_type: 'recording', client: 'Testklant SSE',
    }).select('id').single();
    if (tErr || !t) throw new Error(tErr?.message ?? 'geen thread-id terug');
    threadId = t.id;
    cleanupThreadIds.push(threadId);

    const { error: mErr } = await sb.from('messages').insert({
      thread_id: threadId, role: 'user', content: FAKE_TRANSCRIPT,
    });
    if (mErr) throw new Error('bericht invoegen mislukt: ' + mErr.message);
  } catch (e) {
    fail('TDB1', 'DB-fallback transcript → document met inhoud', ['setup mislukt: ' + e.message]);
    threadId = null;
  }

  if (threadId) {
    const { events, timeout, fetchError, httpStatus } = await runSSE(cookie, {
      threadId,
      message: 'Maak een samenvatting',
      outputType: 'meeting-summary',
      recordingThreadId: threadId,
      // recordingTranscript bewust weggelaten — simuleert browser met stale messagesRef
    }, tenantHostname);

    if (timeout) {
      fail('TDB1', 'DB-fallback transcript → document met inhoud', [`TIMEOUT na ${SSE_TIMEOUT / 1000}s`]);
    } else if (fetchError) {
      fail('TDB1', 'DB-fallback transcript → document met inhoud', [fetchError]);
    } else if (httpStatus !== 200) {
      fail('TDB1', 'DB-fallback transcript → document met inhoud', [`HTTP ${httpStatus}`]);
    } else {
      const { failures, content } = checkSSE(events, {
        mustContain: [/student|budget|energie|ambassador|ruben/i],
        mustNotContain: [/wat is de input|plak.*transcript|geen.*input/i],
      });
      if (failures.length === 0) pass('TDB1', 'DB-fallback transcript → document bevat transcriptinhoud');
      else {
        fail('TDB1', 'DB-fallback transcript → document met inhoud', failures);
        console.log(`    → preview: "${content.replace(/\n/g, ' ')}"`);
      }
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
