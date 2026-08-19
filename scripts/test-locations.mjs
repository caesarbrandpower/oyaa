/**
 * Testscript voor search_locations tool-use.
 *
 * T1-T7: roepen Anthropic direct aan — geen HTTP-server nodig.
 *   BLIND SPOT: route.js wordt nooit geraakt. Bugs in /api/chat-custom
 *   (ontbrekend done-event, stream die niet sluit, vroege return zonder juiste
 *   SSE-structuur) zijn voor T1-T7 volledig onzichtbaar. De RUN_TIMEOUT_MS
 *   guard pakt alleen hangen in de Anthropic API zelf, niet in de route.
 *
 * TD1-TD4: pure unit tests voor detectielogica in route.js — geen API-aanroep.
 *
 * TS1: raakt /api/chat-custom via HTTP, parst de SSE-stroom event voor event,
 *   en faalt als het done-event niet binnen de tijdslimiet arriveert of als
 *   done.content of done.messageId ontbreekt. Vereist OYAA_TEST_COOKIE en
 *   optioneel OYAA_TEST_BASE_URL in .env.local (zie onderaan dit bestand).
 *
 * Run: node scripts/test-locations.mjs
 */
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Laad env vars uit .env.local
const envRaw = readFileSync(resolve(root, '.env.local'), 'utf8');
const env = {};
for (const line of envRaw.split('\n')) {
  const m = line.match(/^([A-Z_]+)=["']?(.+?)["']?\s*$/);
  if (m) env[m[1]] = m[2];
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE  = env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = env.ANTHROPIC_API_KEY;
const CHASE_STAGING = 'bcee1045-2006-4f1a-8a29-838eb2b6fca5';

const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

// Importeer tool-schema en uitvoerfunctie
const { LOCATION_TOOL_SCHEMA, executeLocationTool, buildLocationNameContext } = await import(`${root}/lib/locations-retrieval.js`);

// Haal tenant op en bouw locatiecontext
const { data: tenant } = await sb.from('tenants').select('*').eq('id', CHASE_STAGING).single();
const locationNameContext = await buildLocationNameContext(tenant, sb);

const WEB_SEARCH_TOOL = { type: 'web_search_20250305', name: 'web_search', max_uses: 5 };
const TOOLS = [WEB_SEARCH_TOOL, LOCATION_TOOL_SCHEMA];

// SYSTEM wordt volledig bepaald door buildLocationNameContext (incl. formatinstructies).
// Voeg hier alleen de basisrol toe; verdere instructies zitten in de context.
const SYSTEM = [
  { type: 'text', text: 'Je bent een AI-assistent voor een eventmarketingbureau. Je helpt accountmanagers bij locatie- en mediaplanning voor sampling-campagnes en evenementen in Nederland.' },
  { type: 'text', text: locationNameContext },
];

// Verboden tijdseenheid-patronen bij prijzen — gelden voor alle tests
const NO_TIME_UNIT = [/\/dag\b/i, /\/week\b/i, /\/maand\b/i, /per dag\b/i, /per week\b/i, /per maand\b/i, /per jaar\b/i];

// Acceptatiecriteria per test
const TESTS = [
  {
    id: 'T1',
    q: 'Wat is een goedkoper alternatief voor Utrecht Centraal?',
    checks: {
      must_call:  'search_locations',
      must_have:  [/bereik|cpm|€/i],
      must_not:   [/geen toegang/i, /http[s]?:\/\//i, ...NO_TIME_UNIT],
      stop_reason_first: 'tool_use',
    },
  },
  {
    id: 'T2',
    q: 'Welke locaties hebben we in Amsterdam?',
    checks: {
      must_call:  'search_locations',
      must_have:  [/bereik|€/i, /amsterdam/i],
      must_not:   [/wil je dat ik de cijfers/i, /geen toegang/i, ...NO_TIME_UNIT],
      stop_reason_first: 'tool_use',
    },
  },
  {
    id: 'T3',
    q: 'Wat kost Amsterdam Centraal?',
    checks: {
      must_call:  'search_locations',
      must_have:  [/2\.100|2100/i],
      must_not:   [/geen toegang/i, /fictief|schat/i, ...NO_TIME_UNIT],
      stop_reason_first: 'tool_use',
    },
  },
  {
    id: 'T4',
    q: 'Welke locatie in Rotterdam heeft de laagste CPM?',
    checks: {
      must_call:  'search_locations',
      must_have:  [/rotterdam/i, /cpm|€\d/i],
      must_not:   [/geen toegang/i, ...NO_TIME_UNIT],
      stop_reason_first: 'tool_use',
    },
  },
  {
    id: 'T5',
    q: 'Wat kost Utrecht Centraal en wat is gemiddeld stationstarief in Nederland?',
    checks: {
      must_call:  'search_locations',
      must_have:  [/utrecht centraal/i],
      must_not:   [...NO_TIME_UNIT],
      stop_reason_first: 'tool_use',
    },
  },
  {
    id: 'T6',
    q: 'Welke locaties hebben nog geen bereik?',
    checks: {
      must_call:  'search_locations',
      must_have:  [/16|zestien/i],
      must_not:   [/heeft bereik|[0-9]\.000|[0-9]{4,}/, ...NO_TIME_UNIT],
      stop_reason_first: 'tool_use',
    },
  },
  {
    id: 'T7',
    q: 'Wat kost Amsterdam Centraal?',
    checks: {
      must_call:  'search_locations',
      must_have:  [/€/i],
      must_not:   [...NO_TIME_UNIT, /geen toegang/i],
      stop_reason_first: 'tool_use',
    },
  },
];

const RUN_TIMEOUT_MS = 45_000;

async function runOnce(q) {
  const messages = [{ role: 'user', content: q }];

  const stream = anthropic.beta.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM,
    messages,
    tools: TOOLS,
    betas: ['web-search-2025-03-05'],
  });

  const pendingToolCalls = [];
  let currentTool = null;
  let textBuf = '';

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_start' && chunk.content_block?.type === 'tool_use') {
      currentTool = { id: chunk.content_block.id, name: chunk.content_block.name, inputStr: '' };
      pendingToolCalls.push(currentTool);
    } else if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'input_json_delta' && currentTool) {
      currentTool.inputStr += chunk.delta.partial_json;
    } else if (chunk.type === 'content_block_stop') {
      currentTool = null;
    } else if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
      textBuf += chunk.delta.text;
    }
  }

  const firstMsg = await stream.finalMessage();
  const stopReason = firstMsg.stop_reason;
  const calledTools = pendingToolCalls.map(tc => tc.name);

  let finalText = textBuf;
  let toolInputsParsed = [];

  if (stopReason === 'tool_use' && pendingToolCalls.length > 0) {
    const toolResults = await Promise.all(pendingToolCalls.map(async tc => {
      let resultText = 'Onbekende tool.';
      if (tc.name === 'search_locations') {
        try {
          const input = JSON.parse(tc.inputStr);
          toolInputsParsed.push(input);
          const res = await executeLocationTool(input, sb, CHASE_STAGING);
          resultText = res.text;
        } catch (e) {
          resultText = 'Tool-fout: ' + e.message;
        }
      }
      return { tool_use_id: tc.id, content: resultText };
    }));

    const msgs2 = [
      ...messages,
      { role: 'assistant', content: firstMsg.content },
      { role: 'user', content: toolResults.map(r => ({ type: 'tool_result', tool_use_id: r.tool_use_id, content: r.content })) },
    ];

    const stream2 = anthropic.beta.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM,
      messages: msgs2,
      tools: [LOCATION_TOOL_SCHEMA],
      betas: ['web-search-2025-03-05'],
    });

    let text2 = '';
    for await (const chunk of stream2) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        text2 += chunk.delta.text;
      }
    }
    finalText = text2;
  }

  return { stopReason, calledTools, toolInputsParsed, finalText };
}

function check(testDef, result) {
  const failures = [];
  const { checks } = testDef;
  const text = result.finalText;

  if (checks.must_call && !result.calledTools.includes(checks.must_call)) {
    failures.push(`tool niet aangeroepen: ${checks.must_call} (wel: ${result.calledTools.join(', ') || 'geen'})`);
  }
  if (checks.stop_reason_first && result.stopReason !== checks.stop_reason_first) {
    failures.push(`stop_reason was ${result.stopReason}, verwacht ${checks.stop_reason_first}`);
  }
  for (const re of checks.must_have ?? []) {
    if (!re.test(text)) failures.push(`ontbreekt in antwoord: ${re}`);
  }
  for (const re of checks.must_not ?? []) {
    if (re.test(text)) failures.push(`mag niet in antwoord: ${re}`);
  }
  return failures;
}

// Draai elke test 3 keer
const RUNS = 3;
const summary = [];

for (const test of TESTS) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${test.id} — ${test.q}`);
  const runResults = [];
  for (let run = 1; run <= RUNS; run++) {
    process.stdout.write(`  Run ${run}/${RUNS}... `);
    let result;
    try {
      result = await Promise.race([
        runOnce(test.q),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), RUN_TIMEOUT_MS)),
      ]);
    } catch (err) {
      console.log('FAIL (timeout/error)');
      console.log('    ✗', err.message);
      runResults.push({ run, passed: false, failures: [err.message], stopReason: 'error', calledTools: [], toolInputsParsed: [], finalText: '' });
      continue;
    }
    const failures = check(test, result);
    const passed = failures.length === 0;
    console.log(passed ? 'PASS' : 'FAIL');
    if (!passed) {
      failures.forEach(f => console.log('    ✗', f));
    }
    console.log(`    stop_reason=${result.stopReason} | tools_called=${result.calledTools.join(', ') || 'geen'}`);
    if (result.toolInputsParsed.length > 0) {
      console.log('    tool_inputs:', JSON.stringify(result.toolInputsParsed));
    }
    console.log('    antwoord (eerste 200 tekens):', result.finalText.slice(0, 200).replace(/\n/g, ' '));
    runResults.push({ run, passed, failures, ...result });
  }
  const allPassed = runResults.every(r => r.passed);
  summary.push({ id: test.id, allPassed, runs: runResults });
}

console.log('\n\n' + '='.repeat(60));
console.log('SAMENVATTING — locatie tool-use');
console.log('='.repeat(60));
let totalPass = 0, totalFail = 0;
for (const s of summary) {
  const passCount = s.runs.filter(r => r.passed).length;
  console.log(`${s.id}: ${passCount}/${RUNS} runs geslaagd ${s.allPassed ? '✓' : '✗'}`);
  if (!s.allPassed) {
    const failRuns = s.runs.filter(r => !r.passed);
    failRuns.forEach(r => r.failures.forEach(f => console.log(`   run ${r.run}: ${f}`)));
  }
  if (s.allPassed) totalPass++; else totalFail++;
}
console.log(`\nTotaal locatie: ${totalPass}/${summary.length} tests volledig geslaagd`);

// ── TD: Document-input detectie (unit tests, geen API-aanroep) ───────────────

console.log('\n\n' + '='.repeat(60));
console.log('TD — document-input detectie (unit)');
console.log('='.repeat(60));

// Replica van de route-logica — moet 1-op-1 overeenkomen met route.js
function computeDocInputFlags({ message, txtAttachments = [], documentAttachments = [], recordingTranscript = null }) {
  const userOnlyMessage = message.split(/\n\n\[(?:Bijlage|Transcript):/)[0].trim();
  const hasOwnContent = documentAttachments.length > 0 || txtAttachments.length > 0;
  const hasGenerateIntent = /\b(maak|genereer)\b.{0,60}\b(briefing|evaluatie|rapport)\b|\b(maak\s+(de|hem|het|dit|haar))\b|\bdoe\s+het\s*(maar)?\b|\bbrief\w*\s+voor\s+\S/i.test(userOnlyMessage);
  const wantsVaultAsInput = /\b(?:uit\s+de\s+kluis|vanuit\s+de\s+kluis|gebruik\s+de\s+kluis|in\s+de\s+kluis|van\s+de\s+kluis|via\s+de\s+kluis)\b/i.test(userOnlyMessage);

  let contentBeyondCommand = userOnlyMessage;
  if (hasGenerateIntent) {
    const intentRe = /\b(?:maak|genereer)\b.{0,60}\b(?:briefing|evaluatie|rapport)\b|\b(?:maak\s+(?:de|hem|het|dit|haar))\b|\bdoe\s+het\s*(?:maar)?\b|\bbrief\w*\s+voor\s+\S/i;
    const m = userOnlyMessage.match(intentRe);
    if (m) {
      contentBeyondCommand = (userOnlyMessage.slice(0, m.index) + ' ' + userOnlyMessage.slice(m.index + m[0].length)).trim();
    }
  }

  const hasSubstantialInput =
    hasOwnContent
    || !!recordingTranscript
    || message.length > userOnlyMessage.length
    || userOnlyMessage.includes('\n')
    || contentBeyondCommand.length > 70;

  const isEmptyDocumentRequest = hasGenerateIntent && !hasSubstantialInput && !wantsVaultAsInput;

  return { hasGenerateIntent, hasSubstantialInput, wantsVaultAsInput, isEmptyDocumentRequest, contentBeyondCommand };
}

const DOC_TESTS = [
  {
    id: 'TD1',
    description: 'Kale opdracht — moet vragen om input',
    input: { message: 'Maak een briefing naar de PM voor Coca-Cola' },
    expected: { isEmptyDocumentRequest: true },
  },
  {
    id: 'TD2',
    description: 'Opdracht + ~80 tekens input op één regel — moet document maken',
    input: { message: 'Maak een briefing naar de PM voor Coca-Cola. Klant wil sampling op Utrecht Centraal in september, budget 15k, doelgroep studenten.' },
    expected: { isEmptyDocumentRequest: false, hasSubstantialInput: true },
  },
  {
    id: 'TD3',
    description: 'Opdracht + geplakt transcript met newlines — moet document maken',
    input: { message: 'Maak een briefing naar de PM.\n\nDatum: 15 september\nLocatie: Utrecht Centraal\nBudget: €15.000\nDoelgroep: studenten 18-25\nContact: Sarah de Vries' },
    expected: { isEmptyDocumentRequest: false, hasSubstantialInput: true },
  },
  {
    id: 'TD4',
    description: 'Expliciete kluis-aanroep — moet kluis gebruiken (niet vragen)',
    input: { message: 'Maak een briefing op basis van wat in de kluis staat over Coca-Cola' },
    expected: { isEmptyDocumentRequest: false, wantsVaultAsInput: true },
  },
];

let docPass = 0, docFail = 0;
for (const test of DOC_TESTS) {
  const result = computeDocInputFlags(test.input);
  const failures = [];
  for (const [key, val] of Object.entries(test.expected)) {
    if (result[key] !== val) {
      failures.push(`${key}: verwacht ${val}, kreeg ${result[key]} (contentBeyondCommand: "${result.contentBeyondCommand}")`);
    }
  }
  const passed = failures.length === 0;
  console.log(`\n${test.id} — ${test.description}`);
  console.log(`  ${passed ? 'PASS ✓' : 'FAIL ✗'}`);
  failures.forEach(f => console.log(`    ✗ ${f}`));
  if (!passed) {
    console.log(`  contentBeyondCommand (${result.contentBeyondCommand.length} tekens): "${result.contentBeyondCommand.slice(0, 80)}"`);
  }
  if (passed) docPass++; else docFail++;
}
console.log(`\nTotaal document-detectie: ${docPass}/${DOC_TESTS.length} geslaagd ${docFail === 0 ? '✓' : '✗'}`);

// ── TS: SSE route-integriteit ─────────────────────────────────────────────────
//
// T1-T7 raken route.js nooit — ze bellen Anthropic direct. Bugs in route.js
// (ontbrekend done-event, kluis als input, klantnaam-extractie) zijn daarvoor
// volledig onzichtbaar.
//
// TS-tests sturen een echt HTTP-verzoek naar /api/chat-custom, lezen de SSE-
// stroom event voor event, en controleren done-event én inhoud.
//
// Auth wordt automatisch gegenereerd via auth.admin.generateLink + verifyOtp.
// Geen cookie uit DevTools nodig.
//
// Optioneel in .env.local:
//   OYAA_TEST_BASE_URL — default: http://localhost:3000
//   OYAA_TEST_EMAIL    — default: ruben@chase.amsterdam

const TS_BASE_URL = (env.OYAA_TEST_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const TS_TIMEOUT  = 90_000;
// Testgebruiker: eerste gebruiker van het chase-staging tenant
const TS_EMAIL    = env.OYAA_TEST_EMAIL ?? 'ruben@chase.amsterdam';

console.log('\n\n' + '='.repeat(60));
console.log('TS — SSE route-integriteit');
console.log('='.repeat(60));
console.log(`  Base URL: ${TS_BASE_URL}`);

// Genereer programmatisch een sessie via de admin API (geen cookie uit DevTools nodig).
// Patroon: generateLink(magiclink) → email_otp → verifyOtp → access_token → cookie.
async function generateSessionCookie() {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink', email: TS_EMAIL,
  });
  if (linkErr) throw new Error('generateLink: ' + linkErr.message);

  const { createClient: cc } = await import('@supabase/supabase-js');
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const anon = cc(SUPABASE_URL, anonKey);
  const { data: sess, error: sessErr } = await anon.auth.verifyOtp({
    email: TS_EMAIL,
    token: link.properties.email_otp,
    type: 'email',
  });
  if (sessErr || !sess?.session) throw new Error('verifyOtp: ' + (sessErr?.message ?? 'geen sessie'));

  // @supabase/ssr leest de sessie uit een cookie met naam sb-<project-ref>-auth-token.
  // De waarde wordt opgeslagen als "base64-<base64url(sessionJson)>".
  const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
  const cookieName = `sb-${ref}-auth-token`;
  const encoded = 'base64-' + Buffer.from(JSON.stringify(sess.session)).toString('base64url');
  return `${cookieName}=${encoded}`;
}

// Stuurt één SSE-verzoek naar de route en verzamelt alle events tot done/error/timeout.
async function runSSERequest(cookieHeader, body, tenantHostname) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TS_TIMEOUT);
  try {
    const reqHeaders = { 'Content-Type': 'application/json', 'Cookie': cookieHeader };
    if (tenantHostname) reqHeaders['x-tenant-hostname'] = tenantHostname;
    const res = await fetch(`${TS_BASE_URL}/api/chat-custom`, {
      method: 'POST',
      headers: reqHeaders,
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    if (!res.ok) {
      clearTimeout(timer);
      return { httpStatus: res.status, events: [] };
    }
    const events = [];
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop();
      for (const part of parts) {
        for (const line of part.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            events.push(ev);
            if (ev.type === 'done' || ev.type === 'error') break outer;
          } catch { /* ongeldige JSON — sla over */ }
        }
      }
    }
    clearTimeout(timer);
    return { httpStatus: 200, events };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') return { httpStatus: 0, events: [], timeout: true };
    return { httpStatus: 0, events: [], error: err.message };
  }
}

const TS_TESTS = [
  {
    // Geval 1: kale opdracht → vraag om input, geen kluis, geen document
    id: 'TS1',
    description: 'Kale opdracht → vraag om input (geen kluis, geen document)',
    body: { message: 'Maak een briefing naar de PM voor Coca-Cola', outputType: 'account-to-pm' },
    checks: (events) => {
      const doneEvent = events.find(e => e.type === 'done');
      const f = [];
      if (!doneEvent)                        f.push('geen done-event ontvangen');
      if (doneEvent && !doneEvent.content)   f.push('done.content ontbreekt of leeg');
      if (doneEvent && !doneEvent.messageId) f.push('done.messageId ontbreekt');
      const content = doneEvent?.content ?? '';
      if (!content.match(/input|campagne|plak|transcript/i)) {
        f.push('geen vraag om input gevonden: ' + content.slice(0, 100));
      }
      if (content.length > 500) {
        f.push('response te lang — vermoedelijk gegenereerde briefing i.p.v. vraag (' + content.length + ' tekens)');
      }
      return { failures: f, doneEvent };
    },
  },
  {
    // Geval 2: opdracht met input → document op uitsluitend die input, geen kluisbronnen
    id: 'TS2',
    description: 'Opdracht + input → document zonder kluisbronnen, gemarkeerde gaten',
    body: {
      message: 'Maak een briefing naar de PM voor Coca-Cola. Sampling op Utrecht Centraal in september, budget 15k, doelgroep studenten 18-25.',
      outputType: 'account-to-pm',
    },
    checks: (events) => {
      const doneEvent = events.find(e => e.type === 'done');
      const f = [];
      if (!doneEvent)                        f.push('geen done-event ontvangen');
      if (doneEvent && !doneEvent.content)   f.push('done.content ontbreekt of leeg');
      if (doneEvent && !doneEvent.messageId) f.push('done.messageId ontbreekt');
      const content = doneEvent?.content ?? '';
      if (content.length < 200) {
        f.push('response te kort voor een document (' + content.length + ' tekens) — vermoedelijk fout of vraag');
      }
      if (!/utrecht centraal|15\.?000|studenten/i.test(content)) {
        f.push('input-gegevens niet terug in document — kluis heeft mogelijk de input overschreven');
      }
      return { failures: f, doneEvent };
    },
  },
  {
    // Geval 3: expliciete kluis-aanroep → kluis wordt gebruikt, klantnaam is "Coca-Cola" en niet "Coca-Cola Op Basis"
    id: 'TS3',
    description: 'Expliciete kluis-aanroep → kluis wordt gebruikt, klantnaam is Coca-Cola',
    body: {
      message: 'Maak een briefing op basis van wat in de kluis staat over Coca-Cola',
      outputType: 'account-to-pm',
    },
    checks: (events) => {
      const doneEvent = events.find(e => e.type === 'done');
      const f = [];
      if (!doneEvent)                        f.push('geen done-event ontvangen');
      if (doneEvent && !doneEvent.content)   f.push('done.content ontbreekt of leeg');
      if (doneEvent && !doneEvent.messageId) f.push('done.messageId ontbreekt');
      const content = doneEvent?.content ?? '';
      if (content.length < 50) {
        f.push('response te kort (' + content.length + ' tekens)');
      }
      // Klantnaam-bug: "Coca-Cola Op Basis" mag niet in content als klantnaam verschijnen
      if (/coca.cola\s+op\s+basis/i.test(content)) {
        f.push('klantnaam bevat "Op Basis" — kluis-frase niet gestript voor client-detectie');
      }
      return { failures: f, doneEvent };
    },
  },
  {
    // Geval 4: locatievraag → onveranderd (regressietest)
    // Check: tool aangeroepen (debug_tools aanwezig) — niet op response-inhoud, want model kan soms
    // om verduidelijking vragen terwijl de tool al is aangeroepen.
    id: 'TS4',
    description: 'Locatievraag → search_locations wordt gebruikt (regressie)',
    body: { message: 'Wat is een goedkoper alternatief voor Utrecht Centraal?' },
    checks: (events) => {
      const doneEvent = events.find(e => e.type === 'done');
      const debugEvent = events.find(e => e.type === 'debug_tools');
      const f = [];
      if (!doneEvent)                        f.push('geen done-event ontvangen');
      if (doneEvent && !doneEvent.content)   f.push('done.content ontbreekt of leeg');
      if (doneEvent && !doneEvent.messageId) f.push('done.messageId ontbreekt');
      if (!debugEvent) {
        f.push('geen debug_tools event — search_locations werd niet aangeroepen');
      } else {
        const called = debugEvent.tools_called ?? [];
        if (!called.includes('search_locations')) {
          f.push('search_locations niet in tools_called: ' + JSON.stringify(called));
        }
      }
      return { failures: f, doneEvent };
    },
  },
  {
    // Geval 5: doelgroep-filter → search_locations aangeroepen met doelgroep param;
    //          locaties zonder doelgroep vallen buiten het resultaat.
    //
    // Voorwaarde: migratie 035 moet zijn uitgevoerd (doelgroep is text[]).
    // Vóór de test zetten we doelgroep=['Studenten'] op één locatie (Alkmaar),
    // zodat er altijd minstens één resultaat terugkomt. Na de test herstellen we.
    id: 'TS5',
    description: 'Doelgroep-filter → search_locations met doelgroep-param; locaties zonder doelgroep vallen buiten resultaat',
    body: { message: 'Welke locaties bereiken studenten?' },
    checks: (events) => {
      const doneEvent = events.find(e => e.type === 'done');
      const debugEvent = events.find(e => e.type === 'debug_tools');
      const f = [];
      if (!doneEvent)                        f.push('geen done-event ontvangen');
      if (doneEvent && !doneEvent.content)   f.push('done.content ontbreekt of leeg');
      if (doneEvent && !doneEvent.messageId) f.push('done.messageId ontbreekt');
      if (!debugEvent)                       f.push('geen debug_tools event — search_locations werd niet aangeroepen');
      // Controleer of de tool-call een doelgroep-parameter bevat
      if (!debugEvent) {
        f.push('geen debug_tools event — search_locations werd niet aangeroepen');
      } else {
        const called = debugEvent.tools_called ?? [];
        if (!called.includes('search_locations')) {
          f.push('search_locations niet in tools_called: ' + JSON.stringify(called));
        }
        // Controleer of de tool-call een doelgroep-parameter bevat.
        // Vereist migratie 035 (doelgroep als text[]). Zonder migratie kan het model
        // de doelgroep-filter niet kennen vanuit bestaande locatiedata.
        const tools = Array.isArray(debugEvent.tools) ? debugEvent.tools : [];
        const hasDoelgroepParam = tools.some(t =>
          t.name === 'search_locations' && t.input && 'doelgroep' in t.input
        );
        if (!hasDoelgroepParam) {
          f.push('search_locations aangeroepen zonder doelgroep-parameter — model filtert niet op doelgroep (migratie 035 toegepast?)');
        }
      }
      // Almere Centrum heeft geen doelgroep — mag NIET in de response verschijnen.
      // Alkmaar heeft doelgroep=['Studenten'] (setup vóór de test) — MAG wel verschijnen.
      const content = doneEvent?.content ?? '';
      if (/almere centrum/i.test(content)) {
        f.push('Almere Centrum (geen doelgroep) verschijnt in de response — filter werkt niet');
      }
      return { failures: f, doneEvent };
    },
  },
];

// IDs voor TS5-seeddata
const TS5_LOCATIE_ID = 'ebde9d18-cc15-41ec-a4c6-da26649a700c'; // Alkmaar

let tsCookie;
try {
  process.stdout.write('  Sessie genereren... ');
  tsCookie = await generateSessionCookie();
  console.log('OK');
} catch (err) {
  console.log('FAIL ✗ — sessie genereren mislukt: ' + err.message);
  tsCookie = null;
}

let tsPass = 0, tsFail = 0;

if (tsCookie) {
  for (const test of TS_TESTS) {
    console.log(`\n${test.id} — ${test.description}`);

    // TS5: seed doelgroep vóór test, herstel daarna
    if (test.id === 'TS5') {
      const { error: seedErr } = await sb.from('locations').update({ doelgroep: ['Studenten'] }).eq('id', TS5_LOCATIE_ID);
      if (seedErr) {
        console.log('  SKIP — doelgroep-seeddata mislukt: ' + seedErr.message + ' (migratie 035 nog niet uitgevoerd?)');
        tsFail++;
        continue;
      }
    }

    const { httpStatus, events, timeout, error: fetchErr } = await runSSERequest(tsCookie, test.body, tenant?.hostname);

    // TS5 teardown: herstel doelgroep ongeacht testresultaat
    if (test.id === 'TS5') {
      const { error: teardownErr } = await sb.from('locations').update({ doelgroep: null }).eq('id', TS5_LOCATIE_ID);
      if (teardownErr) console.log('  (teardown fout: ' + teardownErr.message + ')');
    }

    if (timeout) {
      console.log(`  FAIL ✗ — TIMEOUT: geen done-event binnen ${TS_TIMEOUT / 1000}s`);
      tsFail++;
      continue;
    }
    if (fetchErr) {
      console.log(`  FAIL ✗ — ${fetchErr}`);
      tsFail++;
      continue;
    }
    if (httpStatus !== 200) {
      console.log(`  FAIL ✗ — HTTP ${httpStatus}`);
      tsFail++;
      continue;
    }

    const { failures, doneEvent } = test.checks(events);
    const passed = failures.length === 0;
    console.log(`  ${passed ? 'PASS ✓' : 'FAIL ✗'}`);
    failures.forEach(f => console.log(`    ✗ ${f}`));
    console.log(`    events: ${events.map(e => e.type).join(', ') || 'geen'}`);
    if (doneEvent?.content)   console.log(`    done.content: "${String(doneEvent.content).slice(0, 120)}"`);
    if (doneEvent?.messageId) console.log(`    done.messageId: ${doneEvent.messageId}`);
    if (passed) tsPass++; else tsFail++;
  }

  const tsTotal = TS_TESTS.length;
  console.log(`\nSAMENVATTING — SSE route-integriteit`);
  TS_TESTS.forEach((t, i) => {
    // we don't track per-test pass/fail simply, so just report total
  });
  console.log(`Totaal TS: ${tsPass}/${tsTotal} geslaagd ${tsFail === 0 ? '✓' : '✗'}`);
}
