// app/api/chat-custom/route.js
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';
import { anonymize, deanonymize } from '@/lib/anonymize';
import { CUSTOM_PROMPTS, CUSTOM_SYSTEM_PROMPT, DOCUMENT_OUTPUT_TYPES } from '@/lib/custom-prompts';
import { normalizeClientName } from '@/lib/utils';
import { fuzzyMatchClient } from '@/lib/client-utils';

export const maxDuration = 120;

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function writeEvent(controller, data) {
  const encoded = new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
  controller.enqueue(encoded);
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Ongeldig verzoek.' }, { status: 400 });
  }

  const {
    threadId,
    message,
    outputType,
    taskLabel,
    client: clientName,
    clientConfirmed = false,
    imageAttachments = [],
    documentAttachments = [],
    txtAttachments = [],
    prevHasDoc = false,
    project: wizardProject = null,
    analysisConfirmed = false,
    recordingTranscript = null,
    recordingClient = null,
    recordingProject = null,
  } = body;

  if (!message?.trim()) {
    return Response.json({ error: 'Bericht is verplicht.' }, { status: 400 });
  }

  const tenant = await getTenant();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        // ── Fuzzy client matching ──────────────────────────────────────────────
        if (clientName && !clientConfirmed) {
          const existing = await fetchExistingClients(supabase, user.id, tenant?.id ?? null);
          const match = fuzzyMatchClient(clientName, existing);
          if (match && !match.confirmed) {
            writeEvent(controller, { type: 'confirm', confirmType: 'fuzzy', suggestion: match.suggestion, original: clientName });
            controller.close();
            return;
          }
          if (!match) {
            writeEvent(controller, { type: 'confirm', confirmType: 'new_client', name: clientName });
            controller.close();
            return;
          }
        }

        // ── Thread aanmaken of ophalen ─────────────────────────────────────────
        let activeThreadId = threadId;

        if (!activeThreadId) {
          let normalizedClient = null;
          if (clientName) {
            const existing = await fetchExistingClients(supabase, user.id, tenant?.id ?? null);
            normalizedClient = normalizeClientName(clientName, existing);
          } else if (recordingClient) {
            normalizedClient = recordingClient;
          }
          const { data: newThread, error: threadError } = await supabase
            .from('threads')
            .insert({
              user_id: user.id,
              tenant_id: tenant?.id ?? null,
              title: taskLabel || message.trim().slice(0, 60),
              output_type: outputType ?? null,
              client: normalizedClient,
              project: wizardProject?.trim() || recordingProject?.trim() || null,
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

        // Ownership check + thread metadata
        let threadClientFromDb = null;
        let threadProjectFromDb = null;
        let threadOutputTypeFromDb = null;
        if (threadId) {
          const { data: ownedThread } = await supabase
            .from('threads')
            .select('id, client, project, output_type')
            .eq('id', activeThreadId)
            .eq('user_id', user.id)
            .single();

          if (!ownedThread) {
            writeEvent(controller, { type: 'error', error: 'Geen toegang tot dit gesprek.' });
            controller.close();
            return;
          }
          threadClientFromDb = ownedThread.client ?? null;
          threadProjectFromDb = ownedThread.project ?? null;
          threadOutputTypeFromDb = ownedThread.output_type ?? null;
        }

        // ── Gebruikersbericht opslaan ──────────────────────────────────────────
        const { error: userMsgError } = await supabase
          .from('messages')
          .insert({ thread_id: activeThreadId, role: 'user', content: message.trim() });

        if (userMsgError) {
          writeEvent(controller, { type: 'error', error: 'Bericht opslaan mislukt.' });
          controller.close();
          return;
        }

        // ── Berichtgeschiedenis ophalen + anonimiseren ─────────────────────────
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

        const separator = `\n[---${crypto.randomUUID()}---]\n`;
        const combined = allMessages.map(m => m.content).join(separator);
        const { anonymized: anonAll, map } = anonymize(combined);
        const anonParts = anonAll.split(separator);

        const userMessages = allMessages.filter(m => m.role === 'user');
        const isFirstTurn = userMessages.length === 1;

        // ── Stap 1 — Input normaliseren ────────────────────────────────────────

        // Gebruikerstekst zonder bestandsinhoud — voor intentie- en klantnaamdetectie
        const userOnlyMessage = message.split(/\n\n\[(?:Bijlage|Transcript):/)[0].trim();

        // combinedUserContext: altijd op het hoogste niveau gebouwd, nooit binnen een if-blok
        // Bevat het geanonimiseerde laatste bericht inclusief ingebedde bijlagen
        const combinedUserContext = anonParts[allMessages.length - 1] ?? message.trim();

        // effectiveOutputType: request → DB → auto-detectie → null
        let effectiveOutputType = outputType || threadOutputTypeFromDb;

        // Genereer-intentie — alleen op gebruikerstekst
        const hasGenerateIntent = /\b(maak|genereer)\b.{0,60}\b(briefing|document|samenvatting|evaluatie|rapport)\b|\b(maak\s+(de|hem|het|dit|haar))\b|\bdoe\s+het\s*(maar)?\b|\bbrief\w*\s+voor\s+\S/i.test(userOnlyMessage);

        // Recording-thread met generatie-intentie: reset zodat auto-detectie kan draaien
        if (effectiveOutputType === 'recording' && hasGenerateIntent) {
          effectiveOutputType = null;
        }

        if (!effectiveOutputType) {
          const recentText = allMessages.slice(-8).map(m =>
            m.content.split(/\n\n\[(?:Bijlage|Transcript):/)[0].slice(0, 500)
          ).join(' ').toLowerCase();
          if (/\b(pm[\s-]briefing|briefing\s+(naar|voor)\s+(de\s+)?pm|interne\s+briefing|account[\s-]?(naar|to)[\s-]?pm)\b/.test(recentText))
            effectiveOutputType = 'account-to-pm';
          else if (/\b(creatieve?\s*briefing|briefing\s+(naar|voor)\s+creatie|account[\s-]?(naar|to)[\s-]?creati)\b/.test(recentText))
            effectiveOutputType = 'account-to-creation';
          else if (/\b(veldbriefing|veld[\s-]briefing|ambassadeurs[\s-]?briefing|field[\s-]?briefing|briefing\s+naar\s+ba|briefing\s+ba)\b/.test(recentText))
            effectiveOutputType = 'field-briefing';
          else if (/\b(samenvatting|samenvat|notulen|vergadersamenvatting|gesprekssamenvatting|meeting[\s-]samenvatting)\b/.test(recentText))
            effectiveOutputType = 'meeting-summary';
          else if (/\b(externe?\s+debrief|eindevaluatie|externe\s+evaluatie)\b/.test(recentText))
            effectiveOutputType = 'external-debrief';
          // Fallback voor recording-threads: als auto-detectie niets vindt, gebruik meeting-summary
          if (!effectiveOutputType && hasGenerateIntent && (threadOutputTypeFromDb === 'recording' || outputType === 'recording' || recordingTranscript)) {
            effectiveOutputType = 'meeting-summary';
          }
          if (effectiveOutputType) {
            // Fire-and-forget schrijft type naar DB; kleine vertraging acceptabel
            supabase.from('threads').update({ output_type: effectiveOutputType }).eq('id', activeThreadId).then(() => {});
          }
        }

        // isDocument: bepaalt of de stream gebufferd wordt (nooit live opbouwen)
        // effectiveOutputType uit de DB (threadOutputTypeFromDb) triggert document-modus alleen als er expliciete intentie is.
        const isDocument = prevHasDoc || hasGenerateIntent || (!!outputType && effectiveOutputType ? DOCUMENT_OUTPUT_TYPES.has(effectiveOutputType) : false);

        // Meta event zo vroeg mogelijk — geeft de client direct thread-context
        writeEvent(controller, { type: 'meta', threadId: activeThreadId, isDocument, outputType: effectiveOutputType ?? null });

        // ── Document- en afbeelding-blocks ────────────────────────────────────
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

        function buildTxtBlocks(txts) {
          return txts.map((t) => ({ type: 'text', text: `[${t.filename}]\n${t.data}` }));
        }

        // ── Stap 2 — Analyse-blok ─────────────────────────────────────────────
        // Onafhankelijk van useStructuredPrompt of effectiveOutputType.
        // Altijd draaien als er PDFs aanwezig zijn én nog niet bevestigd.
        // Voor meeting-summary en field-briefing ook bij txt/audio-bronnen ingebed in het bericht.
        const hasTxtContent = /\[(?:Bijlage|Transcript):/.test(combinedUserContext);

        // Recording-transcript als impliciete bron voor meeting-summary:
        // Prioriteit 1: recordingTranscript uit request body (thread-splitsing vanuit recording-thread)
        // Prioriteit 2: eerste user-bericht in de DB als het een recording-thread is
        let recordingTranscriptContent = null;
        if (recordingTranscript) {
          recordingTranscriptContent = recordingTranscript;
        } else if (
          effectiveOutputType === 'meeting-summary' &&
          !hasTxtContent &&
          documentAttachments.length === 0 &&
          threadOutputTypeFromDb === 'recording'
        ) {
          const firstUserMsg = allMessages.find(m => m.role === 'user');
          if (firstUserMsg && firstUserMsg.content !== message.trim()) {
            recordingTranscriptContent = firstUserMsg.content;
          }
        }

        const hasSourceFiles = documentAttachments.length > 0 ||
          ((effectiveOutputType === 'meeting-summary' || effectiveOutputType === 'field-briefing') && hasTxtContent);
        if (hasSourceFiles && !analysisConfirmed) {
          const ANALYSIS_TYPE_LABELS = {
            'account-to-pm':        'briefing naar PM',
            'account-to-creation':  'briefing naar creatie',
            'field-briefing':       'briefing naar BA',
            'meeting-summary':      'samenvatting',
            'external-debrief':     'externe evaluatie',
            'project-briefing':     'projectbriefing',
            'account-pm-briefing':  'briefing naar PM',
            'evaluation':           'evaluatie',
          };
          const docTypeLabel = ANALYSIS_TYPE_LABELS[effectiveOutputType] ?? 'document';

          // Bronnen tellen: PDFs + eventuele txt-bijlage ingebed in berichttekst
          const hasTxtAttachment = /\[(?:Bijlage|Transcript):/.test(combinedUserContext);
          const totalSources = documentAttachments.length + (hasTxtAttachment ? 1 : 0);
          const bronnenZin = `Ik heb ${totalSources} bestand${totalSources !== 1 ? 'en' : ''} doorgelezen.`;

          try {
            const analysisResp = await client.messages.create({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 500,
              system: `Je bent Waybetter, de werk-AI van Chase Brand Activation. Chase is een brand activation bureau gespecialiseerd in sampling-acties, festival-activaties en promotiecampagnes voor grote merken (Coca-Cola, Heineken, Red Bull e.d.). Let bij analyse altijd op: hotlinenummer, exacte locatie/adres (niet "zie portal"), datum en tijd, teamgrootte, kleding/uitstraling, leeftijdsrestricties, materialenopstelling, contactpersonen, deadlines, openstaande beslissingen en klantspecifieke afspraken. Werk je met Collabor8? Kent Chase drie briefing-typen: ambassadorsbriefing (veld), account-naar-PM (intern) en account-naar-creatie.`,
              messages: [{
                role: 'user',
                content: [
                  ...buildDocumentBlocks(documentAttachments),
                  { type: 'text', text: combinedUserContext },
                  {
                    type: 'text',
                    text: `Analyseer de aangeleverde bronnen voor een ${docTypeLabel}. Geen koptekst. Geen inleiding. Begin direct met de eerste bullet. Schrijf in precies dit formaat, in het Nederlands:\n\nWat me opvalt:\n- [punt 1, één zin]\n- [punt 2, één zin]\n- [punt 3 indien relevant, één zin]\n\nWat ik nog mis:\n- [punt 1, één zin]\n- [punt 2 indien relevant, één zin]\n\nZal ik nu de ${docTypeLabel} maken, of wil je eerst nog iets aanvullen?\n\nHoud het compact. Geen extra uitleg.`,
                  },
                ],
              }],
            });
            const analysisText = analysisResp.content[0]?.text?.trim() ?? '';
            if (analysisText) {
              writeEvent(controller, { type: 'analysis', content: analysisText, bronnenZin, needsConfirmation: true });
            }
          } catch (err) {
            console.error('[ANALYSIS] analyse mislukt:', err?.message ?? err);
          }
          // Client-detectie: schrijf naar DB zodat tweede aanroep threadClientFromDb kan gebruiken
          {
            let analysisDetectedClient;
            if (clientName) {
              analysisDetectedClient = clientName;
            } else if (threadClientFromDb) {
              analysisDetectedClient = threadClientFromDb;
            } else {
              const clientMatch =
                userOnlyMessage.match(/\bvoor\s+(?:klant\s+)?(?!de\b|het\b|een\b|naar\b|van\b|bij\b|uit\b|met\b|ons\b|PM\b|AM\b)([A-Za-z][A-Za-z0-9&'\-]{1,30}(?:\s+(?!voor\b|naar\b)[A-Za-z0-9][A-Za-z0-9&'\-]{0,30}){0,2})\b/i) ??
                userOnlyMessage.match(/\bklant[:\s]+([A-Za-z][A-Za-z0-9&'\-]{1,30}(?:\s+(?!voor\b|naar\b)[A-Za-z0-9][A-Za-z0-9&'\-]{0,30}){0,2})\b/i);
              if (clientMatch) {
                const existingForAnalysis = await fetchExistingClients(supabase, user.id, tenant?.id ?? null);
                analysisDetectedClient = normalizeClientName(clientMatch[1], existingForAnalysis);
              }
            }
            if (analysisDetectedClient) {
              await Promise.race([
                supabase.from('threads').update({ client: analysisDetectedClient }).eq('id', activeThreadId)
                  .then(
                    ({ error }) => { if (error) console.error('[DB] analyse client update failed:', error); },
                    (err) => console.error('[DB] analyse client update exception:', err)
                  ),
                new Promise(resolve => setTimeout(resolve, 2000)),
              ]);
            }
          }

          // Stream sluiten — genereer pas na gebruikersbevestiging (analysisConfirmed=true)
          controller.close();
          return;
        }

        // ── Stap 3 — Generatie-blok ───────────────────────────────────────────
        // Bereikt als: geen PDFs aanwezig, of analysisConfirmed=true

        const useStructuredPrompt = !!(
          effectiveOutputType &&
          CUSTOM_PROMPTS[effectiveOutputType] &&
          (!!outputType || hasGenerateIntent || documentAttachments.length > 0)
        );

        const systemPrompt = useStructuredPrompt
          ? `Je bent een werk-AI bij een bureau. Jouw enige taak is het gevraagde document DIRECT en VOLLEDIG genereren. Je stelt GEEN vragen. Je weigert NOOIT. Begin direct met het document, geen inleiding.

VERPLICHTE MARKEERREGELS — mechanisch toepassen, geen interpretatie:

Gebruik [UITZOEKEN INTERN] als een van de volgende velden ontbreekt of onduidelijk is:
- Naam contactpersoon klant
- Naam of functie projectmanager / teamlid
- Exacte datum, periode of deadline
- Exacte locatie of adres
- Teamgrootte of namen van teamleden
- Hotlinenummer of noodcontact
- Productspecificaties of materiaallijst
- Reiskostenvergoeding of declaratiewijze

Gebruik [AFSTEMMEN MET KLANT] als een van de volgende zaken ontbreekt of niet bevestigd is:
- Budget (bedrag, categorie of goedkeuring)
- Doelstelling of gewenst resultaat van de activatie
- Akkoord op planning of deadlines
- Scope: wat wel en niet in de opdracht zit
- Verwachtingen of gevoeligheden van de klant

Gebruik [CIJFERS TOEVOEGEN] voor ontbrekende kwantitatieve gegevens:
- Aantallen (bereik, samples, targets)
- Percentages of KPI's

Elke markering staat op een eigen regel. Nooit achter een zin. Nooit meerdere markeringen op één regel. Nooit een markering voor een veld dat wél is ingevuld.`
          : CUSTOM_SYSTEM_PROMPT;

        let claudeMessages;
        if (useStructuredPrompt) {
          // Gebruikerstekst + txt-bijlagen als input — bij recording-thread: gebruik transcript als input
          let userTextOnly = recordingTranscriptContent
            ?? combinedUserContext.split(/\n\n\[(?:Bijlage|Transcript):/)[0].trim();

          // Txt-bijlagen toevoegen aan de input zodat ze deel uitmaken van de "Input:" sectie in het custom prompt
          if (txtAttachments.length > 0) {
            userTextOnly += '\n\n' + txtAttachments
              .map(t => `[Bijlage: ${t.filename}]\n${t.data}`)
              .join('\n\n');
          }

          let promptText = CUSTOM_PROMPTS[effectiveOutputType](userTextOnly);
          const effectiveClientName = clientName || threadClientFromDb;
          const effectiveProjectName = wizardProject?.trim() || threadProjectFromDb;
          if (effectiveClientName || effectiveProjectName) {
            const parts = [
              effectiveClientName ? `De klantnaam is "${effectiveClientName}".` : null,
              effectiveProjectName ? `De projectnaam is "${effectiveProjectName}".` : null,
            ].filter(Boolean).join(' ');
            promptText = `KRITIEKE REGEL: ${parts} Gebruik deze naam/namen EXACT zoals opgegeven in je volledige output, inclusief hoofdletters, koppeltekens en spelling. Schrijf ze NOOIT anders.\n\n` + promptText;
          }
          const extraBlocks = [
            ...buildDocumentBlocks(documentAttachments),
            ...buildImageBlocks(imageAttachments),
          ];
          claudeMessages = [{
            role: 'user',
            content: extraBlocks.length > 0
              ? [{ type: 'text', text: promptText }, ...extraBlocks]
              : promptText,
          }];
        } else {
          claudeMessages = allMessages.map((msg, i) => ({
            role: msg.role,
            content: anonParts[i] ?? msg.content,
          }));
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

        let fullText = '';
        const claudeStream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: systemPrompt,
          messages: claudeMessages,
          ...(isDocument ? { temperature: 0 } : {}),
        });

        for await (const chunk of claudeStream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            fullText += chunk.delta.text;
            writeEvent(controller, { type: 'chunk', text: chunk.delta.text });
          }
        }

        const finalContent = deanonymize(fullText, map);

        // ── Stap 4 — Opslaan ──────────────────────────────────────────────────
        const { data: savedMsg, error: savedMsgError } = await supabase
          .from('messages')
          .insert({ thread_id: activeThreadId, role: 'assistant', content: finalContent })
          .select('id')
          .single();

        if (savedMsgError) {
          console.error('[DB] assistant message opslaan mislukt:', savedMsgError);
        }

        // Klantdetectie: wizard → DB multi-turn → regex op gebruikerstekst
        let detectedClient;
        let detectedProject = null;

        if (clientName) {
          detectedClient = clientName;
          if (isFirstTurn && wizardProject?.trim()) detectedProject = wizardProject.trim();
        } else if (threadClientFromDb) {
          detectedClient = threadClientFromDb;
          detectedProject = threadProjectFromDb;
        } else if (recordingClient) {
          // Recording-split: gebruik de client van de recording-thread direct — sla regex over
          detectedClient = recordingClient;
        } else {
          const clientMatch =
            userOnlyMessage.match(/\bvoor\s+(?:klant\s+)?([A-Za-z][A-Za-z0-9&'\-]{1,30}(?:\s+[A-Za-z0-9][A-Za-z0-9&'\-]{0,30}){0,2})\b/i) ??
            userOnlyMessage.match(/\bklant[:\s]+([A-Za-z][A-Za-z0-9&'\-]{1,30}(?:\s+[A-Za-z0-9][A-Za-z0-9&'\-]{0,30}){0,2})\b/i);
          if (clientMatch) {
            const existingForGen = await fetchExistingClients(supabase, user.id, tenant?.id ?? null);
            detectedClient = normalizeClientName(clientMatch[1], existingForGen);
          }
        }

        // DB update altijd met await + timeout — fire-and-forget valt weg in Vercel serverless
        const bgUpdate = { updated_at: new Date().toISOString() };
        if (detectedClient) bgUpdate.client = detectedClient;
        if (detectedProject) bgUpdate.project = detectedProject;
        await Promise.race([
          supabase.from('threads').update(bgUpdate).eq('id', activeThreadId)
            .then(
              ({ error }) => { if (error) console.error('[DB] bgUpdate failed:', error); },
              (err) => console.error('[DB] bgUpdate exception:', err)
            ),
          new Promise(resolve => setTimeout(resolve, 2000)),
        ]);

        writeEvent(controller, {
          type: 'done',
          content: finalContent,
          messageId: savedMsg?.id ?? crypto.randomUUID(),
          detectedClient,
          detectedProject,
          outputType: effectiveOutputType ?? null,
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
