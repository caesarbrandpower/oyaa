/**
 * Testscript voor search_locations tool-use.
 * Roept Anthropic direct aan — geen HTTP-server nodig.
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
    const result = await runOnce(test.q);
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
