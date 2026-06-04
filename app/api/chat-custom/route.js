// app/api/chat-custom/route.js
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';
import { anonymize, deanonymize } from '@/lib/anonymize';
import { CUSTOM_PROMPTS, CUSTOM_SYSTEM_PROMPT, DOCUMENT_OUTPUT_TYPES } from '@/lib/custom-prompts';
import { normalizeClientName } from '@/lib/utils';
import { fuzzyMatchClient } from '@/lib/client-utils';

export const maxDuration = 120;

// ── Client/project extractie ───────────────────────────────────────────────────

async function fetchExistingClients(supabase, userId, tenantId) {
  const query = supabase
    .from('threads')
    .select('client')
    .eq('user_id', userId)
    .not('client', 'is', null);
  if (tenantId) query.eq('tenant_id', tenantId);
  const { data } = await query;
  return (data ?? []).map((r) => r.client).filter(Boolean);
}

async function detectClientProject(supabase, threadId, message, userId, tenantId) {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 80,
    messages: [{
      role: 'user',
      content: `Zit er een klantnaam of projectnaam in deze tekst? Geef terug als JSON met exacte sleutels: {"client": string|null, "project": string|null}. Alleen JSON, geen uitleg.\n\nTekst: ${message.slice(0, 500)}`,
    }],
  });
  const text = response.content[0]?.text?.trim() ?? '';
  const json = JSON.parse(text);
  if (json.client || json.project) {
    const existingClients = await fetchExistingClients(supabase, userId, tenantId);
    const normalizedClient = normalizeClientName(json.client, existingClients) ?? null;
    const detectedProject = json.project ?? null;
    await supabase.from('threads').update({
      client: normalizedClient,
      project: detectedProject,
    }).eq('id', threadId);
    return { client: normalizedClient, project: detectedProject };
  }
  return { client: null, project: null };
}

function writeEvent(controller, data) {
  const encoded = new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
  controller.enqueue(encoded);
}

export async function POST(request) {
  const tReq = Date.now();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  console.log(`[PERF] auth.getUser: +${Date.now() - tReq}ms`);
  if (!user) {
    return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    console.error('[chat-custom] request.json() failed:', err?.message ?? err);
    return Response.json({ error: 'Ongeldig verzoek.' }, { status: 400 });
  }

  const { threadId, message, outputType, taskLabel, client: clientName, clientConfirmed = false, imageAttachments = [], documentAttachments = [], prevHasDoc = false, project: wizardProject = null } = body;

  console.log('[chat-custom] body keys:', Object.keys(body), '| message:', message?.slice(0, 80), '| docAtts:', documentAttachments?.length, '| imgAtts:', imageAttachments?.length);

  if (!message || !message.trim()) {
    console.warn('[chat-custom] 400: message leeg of ontbreekt. Body keys:', Object.keys(body));
    return Response.json({ error: 'Bericht is verplicht.' }, { status: 400 });
  }

  const tTenant = Date.now();
  const tenant = await getTenant();
  console.log(`[PERF] getTenant: +${Date.now() - tTenant}ms (total: +${Date.now() - tReq}ms)`);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const tStream = Date.now();
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        // Fuzzy matching — vóór thread aanmaken, als naam niet bevestigd is
        if (clientName && !clientConfirmed) {
          const existingForFuzzy = await fetchExistingClients(supabase, user.id, tenant?.id ?? null);
          const match = fuzzyMatchClient(clientName, existingForFuzzy);
          if (match && !match.confirmed) {
            // Typo van bekende klant — vraag bevestiging
            writeEvent(controller, { type: 'confirm', confirmType: 'fuzzy', suggestion: match.suggestion, original: clientName });
            controller.close();
            return;
          }
          if (!match) {
            // Volledig nieuwe klant — vraag bevestiging van schrijfwijze
            writeEvent(controller, { type: 'confirm', confirmType: 'new_client', name: clientName });
            controller.close();
            return;
          }
        }

        let activeThreadId = threadId;

        if (!activeThreadId) {
          const title = taskLabel || message.trim().slice(0, 60);
          let normalizedClient = null;
          if (clientName) {
            const existingClients = await fetchExistingClients(supabase, user.id, tenant?.id ?? null);
            normalizedClient = normalizeClientName(clientName, existingClients);
          }
          const t0 = Date.now();
          const { data: newThread, error: threadError } = await supabase
            .from('threads')
            .insert({
              user_id: user.id,
              tenant_id: tenant?.id ?? null,
              title,
              output_type: outputType ?? null,
              client: normalizedClient,
              project: wizardProject?.trim() || null,
            })
            .select('id')
            .single();
          console.log(`[PERF] insert new thread: +${Date.now() - t0}ms (total: +${Date.now() - tReq}ms)`);

          if (threadError) {
            writeEvent(controller, { type: 'error', error: 'Thread aanmaken mislukt.' });
            controller.close();
            return;
          }
          activeThreadId = newThread.id;

        }

        // Haal thread op voor ownership-check, klantnaam én output_type bij multi-turn
        let threadClientFromDb = null;
        let threadProjectFromDb = null;
        let threadOutputTypeFromDb = null;
        if (threadId) {
          const t0 = Date.now();
          const { data: ownedThread } = await supabase
            .from('threads')
            .select('id, client, project, output_type')
            .eq('id', activeThreadId)
            .eq('user_id', user.id)
            .single();
          console.log(`[PERF] ownership check: +${Date.now() - t0}ms (total: +${Date.now() - tReq}ms)`);

          if (!ownedThread) {
            writeEvent(controller, { type: 'error', error: 'Geen toegang tot dit gesprek.' });
            controller.close();
            return;
          }
          threadClientFromDb = ownedThread.client ?? null;
          threadProjectFromDb = ownedThread.project ?? null;
          threadOutputTypeFromDb = ownedThread.output_type ?? null;
        }

        // effectiveOutputType — wordt later verfijnd met auto-detectie als onbekend
        let effectiveOutputType = outputType || threadOutputTypeFromDb;

        const tInsert = Date.now();
        const { error: userMsgError } = await supabase
          .from('messages')
          .insert({ thread_id: activeThreadId, role: 'user', content: message.trim() });
        console.log(`[PERF] insert user message: +${Date.now() - tInsert}ms (total: +${Date.now() - tReq}ms)`);

        if (userMsgError) {
          writeEvent(controller, { type: 'error', error: 'Bericht opslaan mislukt.' });
          controller.close();
          return;
        }

        const tFetch = Date.now();
        const { data: allMessages, error: messagesError } = await supabase
          .from('messages')
          .select('role, content')
          .eq('thread_id', activeThreadId)
          .order('created_at', { ascending: true });
        console.log(`[PERF] fetch messages (${allMessages?.length ?? 0}): +${Date.now() - tFetch}ms (total: +${Date.now() - tReq}ms)`);

        if (messagesError || !allMessages) {
          writeEvent(controller, { type: 'error', error: 'Berichten ophalen mislukt.' });
          controller.close();
          return;
        }

        // UUID-separator: eliminates any chance of collision with user input
        const separator = `\n[---${crypto.randomUUID()}---]\n`;
        const combined = allMessages.map(m => m.content).join(separator);
        const { anonymized: anonAll, map } = anonymize(combined);
        const anonParts = anonAll.split(separator);

        const userMessages = allMessages.filter(m => m.role === 'user');
        const isFirstTurn = userMessages.length === 1;

        // Auto-detecteer outputType via keywords als onbekend — geen extra API-call
        if (!effectiveOutputType) {
          const recentText = allMessages.slice(-8).map(m => m.content.slice(0, 500)).join(' ').toLowerCase();
          let detected = null;
          if (/\b(pm[\s-]briefing|briefing\s+(naar|voor)\s+(de\s+)?pm|interne\s+briefing|account[\s-]?(naar|to)[\s-]?pm)\b/.test(recentText)) detected = 'account-to-pm';
          else if (/\b(creatieve?\s*briefing|briefing\s+(naar|voor)\s+creatie|account[\s-]?(naar|to)[\s-]?creati)\b/.test(recentText)) detected = 'account-to-creation';
          else if (/\b(veldbriefing|veld[\s-]briefing|ambassadeurs[\s-]?briefing|field[\s-]?briefing)\b/.test(recentText)) detected = 'field-briefing';
          else if (/\b(notulen|vergadersamenvatting|gesprekssamenvatting|meeting[\s-]samenvatting)\b/.test(recentText)) detected = 'meeting-summary';
          else if (/\b(externe?\s+debrief|eindevaluatie|externe\s+evaluatie)\b/.test(recentText)) detected = 'external-debrief';
          if (detected) {
            effectiveOutputType = detected;
            // Fire-and-forget — blokt de meta event niet
            supabase.from('threads').update({ output_type: detected }).eq('id', activeThreadId).then(() => {
              console.log(`[PERF] output_type update done (background)`);
            });
          }
        }

        // Detecteer genereer-intentie in het huidige bericht
        const hasGenerateIntent = /\b(maak|genereer)\b.{0,60}\b(briefing|document|samenvatting|evaluatie|rapport)\b|\b(maak\s+(de|hem|het|dit|haar))\b|\bdoe\s+het\s*(maar)?\b/i.test(message);

        // isDocument: buffers de stream zodat de briefing nooit live opbouwt
        // True als: outputType is een document-type, of er al een doc is, of gebruiker vraagt expliciet te genereren
        const isDocument = (effectiveOutputType ? DOCUMENT_OUTPUT_TYPES.has(effectiveOutputType) : false) || prevHasDoc || hasGenerateIntent;

        // useStructuredPrompt: gebruik gespecialiseerde genereer-prompt
        // Alleen wanneer outputType EXPLICIET uit het request komt (wizard) OF gebruiker vraagt te genereren
        // Niet bij elke conversationele beurt op een thread die al een outputType heeft
        const outputTypeFromRequest = !!outputType;
        const useStructuredPrompt = effectiveOutputType && CUSTOM_PROMPTS[effectiveOutputType] && (outputTypeFromRequest || hasGenerateIntent);

        console.log(`[PERF] meta event → indicator: +${Date.now() - tReq}ms total`);
        writeEvent(controller, { type: 'meta', threadId: activeThreadId, isDocument, outputType: effectiveOutputType ?? null });

        function buildImageBlocks(images) {
          return images.map((img) => ({
            type: 'image',
            source: { type: 'base64', media_type: img.mediaType || 'image/jpeg', data: img.data },
          }));
        }

        function buildDocumentBlocks(docs) {
          return docs.map((doc) => ({
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: doc.data },
            title: doc.filename,
          }));
        }

        let claudeMessages;
        if (useStructuredPrompt) {
          // Combineer volledige gespreksgeschiedenis voor context (inclusief assistent-analyse van eerder geüploade documenten)
          const combinedUserContext = allMessages
            .map((msg, i) => msg.role === 'user' ? (anonParts[i] ?? msg.content) : null)
            .filter(Boolean)
            .join('\n\n');
          let promptText = CUSTOM_PROMPTS[effectiveOutputType](combinedUserContext);
          // Injecteer klantnaam bovenaan zodat AI namen exact overneemt
          const effectiveClientName = clientName || threadClientFromDb;
          const effectiveProjectName = wizardProject?.trim() || threadProjectFromDb;
          if (effectiveClientName || effectiveProjectName) {
            const parts = [
              effectiveClientName ? `De klantnaam is "${effectiveClientName}".` : null,
              effectiveProjectName ? `De projectnaam is "${effectiveProjectName}".` : null,
            ].filter(Boolean).join(' ');
            const nameRule = `KRITIEKE REGEL: ${parts} Gebruik deze naam/namen EXACT zoals opgegeven in je volledige output, inclusief hoofdletters, koppeltekens en spelling. Schrijf ze NOOIT anders.\n\n`;
            promptText = nameRule + promptText;
          }
          const extraBlocks = [
            ...buildDocumentBlocks(documentAttachments),
            ...buildImageBlocks(imageAttachments),
          ];
          claudeMessages = [
            {
              role: 'user',
              content: extraBlocks.length > 0
                ? [{ type: 'text', text: promptText }, ...extraBlocks]
                : promptText,
            },
          ];
        } else {
          claudeMessages = allMessages.map((msg, i) => ({
            role: msg.role,
            content: anonParts[i] ?? msg.content,
          }));
          // Voeg documenten en afbeeldingen toe aan het laatste gebruikersbericht
          const extraBlocks = [
            ...buildDocumentBlocks(documentAttachments),
            ...buildImageBlocks(imageAttachments),
          ];
          if (extraBlocks.length > 0) {
            const lastIdx = claudeMessages.length - 1;
            if (claudeMessages[lastIdx]?.role === 'user') {
              const textContent = claudeMessages[lastIdx].content;
              claudeMessages[lastIdx] = {
                role: 'user',
                content: [
                  { type: 'text', text: typeof textContent === 'string' ? textContent : '' },
                  ...extraBlocks,
                ],
              };
            }
          }
        }

        // Wizard-flow (structured prompt): gebruik een neutrale system prompt zodat de
        // "Je maakt geen document als je niet genoeg weet"-instructie uit CUSTOM_SYSTEM_PROMPT
        // niet botst met de directe genereeropdracht.
        const systemPrompt = useStructuredPrompt
          ? 'Je bent een werk-AI bij een bureau. Jouw enige taak is het gevraagde document DIRECT en VOLLEDIG genereren. Je stelt GEEN vragen. Je weigert NOOIT. Je vraagt NOOIT om meer informatie, ook niet als de input beperkt is. Alles wat ontbreekt markeer je met [UITZOEKEN INTERN] of [AFSTEMMEN MET KLANT]. Begin direct met het document, geen inleiding.'
          : CUSTOM_SYSTEM_PROMPT;

        let fullText = '';
        const claudeStream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: systemPrompt,
          messages: claudeMessages,
        });

        const tClaude = Date.now();
        for await (const chunk of claudeStream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            const text = chunk.delta.text;
            fullText += text;
            writeEvent(controller, { type: 'chunk', text });
          }
        }
        console.log(`[PERF] claude generation done: +${Date.now() - tClaude}ms (total: +${Date.now() - tReq}ms)`);

        const finalContent = deanonymize(fullText, map);

        const tSave = Date.now();
        const { data: savedMsg, error: savedMsgError } = await supabase
          .from('messages')
          .insert({ thread_id: activeThreadId, role: 'assistant', content: finalContent })
          .select('id')
          .single();
        console.log(`[PERF] save assistant message: +${Date.now() - tSave}ms (total: +${Date.now() - tReq}ms)`);

        if (savedMsgError) {
          console.error('Assistant message opslaan mislukt:', savedMsgError);
        }

        // Klantdetectie:
        // - Wizard (clientName gezet): direct gebruiken, geen haiku
        // - Chat multi-turn (threadClientFromDb gezet): direct gebruiken, geen haiku
        // - Chat eerste beurt (beide null): haiku uitvoeren blocking — alleen keer dat het nodig is
        let detectedClient;
        let detectedProject = null;

        if (clientName) {
          // Wizard-flow: client en project direct beschikbaar
          detectedClient = clientName;
          if (isFirstTurn && wizardProject?.trim()) {
            detectedProject = wizardProject.trim();
          }
        } else if (threadClientFromDb) {
          // Multi-turn: al bekend uit DB, geen haiku nodig
          detectedClient = threadClientFromDb;
          detectedProject = threadProjectFromDb;
        } else {
          // Eerste chat-beurt: sync regex — geen netwerkaanroep, geen timeout-risico
          // Pakt patronen als "voor Coca-Cola", "voor klant Nike", "klant: Adidas"
          const clientMatch = message.match(
            /\bvoor\s+(?:klant\s+)?([A-Z][A-Za-z0-9&'\-.]{1,30}(?:\s+[A-Z0-9][A-Za-z0-9&'\-.]{0,30}){0,2})\b/
          ) ?? message.match(
            /\bklant[:\s]+([A-Z][A-Za-z0-9&'\-.]{1,30}(?:\s+[A-Z0-9][A-Za-z0-9&'\-.]{0,30}){0,2})\b/i
          );
          detectedClient = clientMatch ? clientMatch[1].trim() : undefined;
          detectedProject = null;
        }

        console.log(`[PERF] done event → DocumentCard: +${Date.now() - tReq}ms total`);
        writeEvent(controller, {
          type: 'done',
          content: finalContent,
          messageId: savedMsg?.id ?? crypto.randomUUID(),
          detectedClient,
          detectedProject,
          outputType: effectiveOutputType ?? null,
        });

        controller.close();

        // updated_at op de achtergrond — blokt done event niet
        // Supabase geeft een PromiseLike terug zonder .catch() — gebruik .then(null, handler)
        supabase.from('threads').update({ updated_at: new Date().toISOString() }).eq('id', activeThreadId).then(null, () => {});
      } catch (err) {
        console.error('chat-custom stream error:', err);
        writeEvent(controller, { type: 'error', error: 'Er is een fout opgetreden.' });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
