// app/api/chat-custom/route.js
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';
import { anonymize, deanonymize } from '@/lib/anonymize';
import { CUSTOM_PROMPTS, CUSTOM_SYSTEM_PROMPT, DOCUMENT_OUTPUT_TYPES } from '@/lib/custom-prompts';
import { normalizeClientName } from '@/lib/utils';
import { fuzzyMatchClient } from '@/lib/client-utils';

export const maxDuration = 60;

// ── Client/project extractie ───────────────────────────────────────────────────
async function extractClientProject(text) {
  try {
    const ant = new (await import('@anthropic-ai/sdk')).default({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await ant.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      messages: [{ role: 'user', content: `Splits dit op in klantnaam en projectnaam. JSON: {"client": string, "project": string|null}. Alleen JSON.\n\nTekst: ${text}` }],
    });
    const json = JSON.parse(response.content[0]?.text?.trim() ?? '{}');
    return { client: json.client ?? text, project: json.project ?? null };
  } catch {
    return { client: text, project: null };
  }
}

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });
  }

  const { threadId, message, outputType, taskLabel, client: clientName, clientConfirmed = false, imageAttachments = [], prevHasDoc = false } = await request.json();

  if (!message || !message.trim()) {
    return Response.json({ error: 'Bericht is verplicht.' }, { status: 400 });
  }

  const tenant = await getTenant();
  const isDocument = (outputType ? DOCUMENT_OUTPUT_TYPES.has(outputType) : false) || prevHasDoc;

  const stream = new ReadableStream({
    async start(controller) {
      try {
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
          const { data: newThread, error: threadError } = await supabase
            .from('threads')
            .insert({
              user_id: user.id,
              tenant_id: tenant?.id ?? null,
              title,
              output_type: outputType ?? null,
              client: normalizedClient,
            })
            .select('id')
            .single();

          if (threadError) {
            writeEvent(controller, { type: 'error', error: 'Thread aanmaken mislukt.' });
            controller.close();
            return;
          }
          activeThreadId = newThread.id;

        }

        writeEvent(controller, { type: 'meta', threadId: activeThreadId, isDocument });

        // Verify thread ownership when threadId was provided by client
        if (threadId) {
          const { data: ownedThread } = await supabase
            .from('threads')
            .select('id')
            .eq('id', activeThreadId)
            .eq('user_id', user.id)
            .single();

          if (!ownedThread) {
            writeEvent(controller, { type: 'error', error: 'Geen toegang tot dit gesprek.' });
            controller.close();
            return;
          }
        }

        const { error: userMsgError } = await supabase
          .from('messages')
          .insert({ thread_id: activeThreadId, role: 'user', content: message.trim() });

        if (userMsgError) {
          writeEvent(controller, { type: 'error', error: 'Bericht opslaan mislukt.' });
          controller.close();
          return;
        }

        const { data: allMessages, error: messagesError } = await supabase
          .from('messages')
          .select('role, content')
          .eq('thread_id', activeThreadId)
          .order('created_at', { ascending: true });

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
        const useStructuredPrompt = isFirstTurn && outputType && CUSTOM_PROMPTS[outputType];

        function buildImageBlocks(images) {
          return images.map((img) => ({
            type: 'image',
            source: { type: 'base64', media_type: img.mediaType || 'image/jpeg', data: img.data },
          }));
        }

        let claudeMessages;
        if (useStructuredPrompt) {
          const lastUserIdx = anonParts.length - 1;
          let promptText = CUSTOM_PROMPTS[outputType](anonParts[lastUserIdx]);
          // Injecteer klantnaam bovenaan zodat AI namen exact overneemt
          if (clientName) {
            const nameRule = `KRITIEKE REGEL: De klantnaam is "${clientName}". Gebruik deze naam EXACT zoals opgegeven in je volledige output, inclusief hoofdletters, koppeltekens en spelling. Schrijf hem NOOIT anders.\n\n`;
            promptText = nameRule + promptText;
          }
          claudeMessages = [
            {
              role: 'user',
              content: imageAttachments.length > 0
                ? [{ type: 'text', text: promptText }, ...buildImageBlocks(imageAttachments)]
                : promptText,
            },
          ];
        } else {
          claudeMessages = allMessages.map((msg, i) => ({
            role: msg.role,
            content: anonParts[i] ?? msg.content,
          }));
          // Voeg afbeeldingen toe aan het laatste gebruikersbericht
          if (imageAttachments.length > 0) {
            const lastIdx = claudeMessages.length - 1;
            if (claudeMessages[lastIdx]?.role === 'user') {
              const textContent = claudeMessages[lastIdx].content;
              claudeMessages[lastIdx] = {
                role: 'user',
                content: [
                  { type: 'text', text: typeof textContent === 'string' ? textContent : '' },
                  ...buildImageBlocks(imageAttachments),
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

        for await (const chunk of claudeStream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            const text = chunk.delta.text;
            fullText += text;
            writeEvent(controller, { type: 'chunk', text });
          }
        }

        const finalContent = deanonymize(fullText, map);

        const { data: savedMsg, error: savedMsgError } = await supabase
          .from('messages')
          .insert({ thread_id: activeThreadId, role: 'assistant', content: finalContent })
          .select('id')
          .single();

        if (savedMsgError) {
          console.error('Assistant message opslaan mislukt:', savedMsgError);
        }

        await supabase
          .from('threads')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', activeThreadId);

        // Klantdetectie — synchroon zodat resultaat mee in done-event kan
        let detectedClient;
        let detectedProject = null;
        if (!clientName) {
          try {
            const detected = await detectClientProject(supabase, activeThreadId, message, user.id, tenant?.id ?? null);
            detectedClient = detected.client;
            detectedProject = detected.project;
          } catch {
            detectedClient = null;
          }
        } else if (isFirstTurn) {
          // Wizard-flow: splits "Coca-Cola Lentecampagne 26" in client + project
          try {
            const extracted = await extractClientProject(clientName);
            // Alleen een echt project opslaan — niet de klantnaam als project gebruiken
            const projectValue = extracted.project && extracted.project !== clientName
              ? extracted.project
              : null;
            if (projectValue) {
              detectedProject = projectValue;
              const updates = { project: detectedProject };
              if (extracted.client && extracted.client !== clientName) {
                detectedClient = extracted.client;
                updates.client = extracted.client;
              }
              await supabase.from('threads').update(updates).eq('id', activeThreadId);
            } else if (extracted.client && extracted.client !== clientName) {
              detectedClient = extracted.client;
              await supabase.from('threads').update({ client: extracted.client }).eq('id', activeThreadId);
            }
          } catch { /* silent */ }
        }

        console.log('[SERVER DONE]', { detectedClient, detectedProject });

        writeEvent(controller, {
          type: 'done',
          content: finalContent,
          messageId: savedMsg?.id ?? crypto.randomUUID(),
          detectedClient, // undefined | null | string
          detectedProject, // null | string
        });

        controller.close();
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
