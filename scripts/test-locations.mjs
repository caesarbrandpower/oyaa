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

const SYSTEM = [
  { type: 'text', text: 'Je bent een AI-assistent voor een eventmarketingbureau. Je helpt accountmanagers bij locatie- en mediaplanning voor sampling-campagnes en evenementen in Nederland.' },
  { type: 'text', text: locationNameContext },
];

// Acceptatiecriteria per test
const TESTS = [
  {
    id: 'T1',
    q: 'Wat is een goedkoper alternatief voor Utrecht Centraal?',
    checks: {
      must_call:  'search_locations',
      must_have:  [/bereik|cpm|€/i],
      must_not:   [/geen toegang/i, /http[s]?:\/\//i],
      stop_reason_first: 'tool_use',
    },
  },
  {
    id: 'T2',
    q: 'Welke locaties hebben we in Amsterdam?',
    checks: {
      must_call:  'search_locations',
      must_have:  [/bereik|€/i, /amsterdam/i],
      must_not:   [/wil je dat ik de cijfers/i, /geen toegang/i],
      stop_reason_first: 'tool_use',
    },
  },
  {
    id: 'T3',
    q: 'Wat kost Amsterdam Centraal?',
    checks: {
      must_call:  'search_locations',
      must_have:  [/2\.100|2100/i],
      must_not:   [/geen toegang/i, /fictief|schat/i],
      stop_reason_first: 'tool_use',
    },
  },
  {
    id: 'T4',
    q: 'Welke locatie in Rotterdam heeft de laagste CPM?',
    checks: {
      must_call:  'search_locations',
      must_have:  [/rotterdam/i, /cpm|€\d/i],
      must_not:   [/geen toegang/i],
      stop_reason_first: 'tool_use',
    },
  },
  {
    id: 'T5',
    q: 'Wat kost Utrecht Centraal en wat is gemiddeld stationstarief in Nederland?',
    checks: {
      must_call:  'search_locations',
      must_have:  [/utrecht centraal/i],
      must_not:   [],
      stop_reason_first: 'tool_use',
    },
  },
  {
    id: 'T6',
    q: 'Welke locaties hebben nog geen bereik?',
    checks: {
      must_call:  'search_locations',
      must_have:  [/16|zestien/i],
      must_not:   [/heeft bereik|[0-9]\.000|[0-9]{4,}/],
      stop_reason_first: 'tool_use',
    },
  },
  {
    id: 'T7',
    q: 'Wat kost Amsterdam Centraal?',
    checks: {
      must_call:  'search_locations',
      must_have:  [/€/i],
      must_not:   [/per week|per maand|per dag|per jaar/i, /geen toegang/i],
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
console.log('SAMENVATTING');
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
console.log(`\nTotaal: ${totalPass}/${summary.length} tests volledig geslaagd`);
