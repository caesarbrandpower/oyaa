// app/api/chat-custom/route.js
import Anthropic from '@anthropic-ai/sdk';
import { createClient, createServiceClient } from '@/lib/supabase-server';
import { insertTokenUsage } from '@/lib/token-usage';
import { getTenant } from '@/lib/get-tenant';
import { anonymize, deanonymize } from '@/lib/anonymize';
import { CUSTOM_PROMPTS, CUSTOM_SYSTEM_PROMPT, CUSTOM_SYSTEM_PROMPTS, buildFreeChatSystemPrompt, DOCUMENT_OUTPUT_TYPES, OUTPUT_TYPE_INFO } from '@/lib/custom-prompts';
import { normalizeClientName } from '@/lib/utils';
import { fuzzyMatchClient } from '@/lib/client-utils';
import { retrieveVaultContext, formatVaultBlock, retrieveFullDocument } from '@/lib/vault/retrieve';
import { ingestDocument } from '@/lib/vault/ingest';
import { extractFileText } from '@/lib/extract-file-text';
import { vaultEnabled } from '@/lib/vault/access';
import { looksLikeDocument } from '@/lib/document-utils';
import { buildDatabaseContext } from '@/lib/locations-retrieval';
import { hasWriteIntent, parseWriteIntent } from '@/lib/locations-write';
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

  const rawName =
    user.user_metadata?.full_name?.split(' ')[0] ||
    user.user_metadata?.name?.split(' ')[0] ||
    user.email?.split('@')[0] ||
    null;
  const firstName = rawName
    ? rawName.charAt(0).toUpperCase() + rawName.slice(1)
    : null;

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
    hasUserContent: bodyHasUserContent = true,
    improveDocument = false,
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
          if (clientName && clientName.length < 100) {
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
        // Bij verbetermodus: sla de korte aanduiding op zodat de chathistorie leesbaar blijft.
        // De Claude-prompt gebruikt message uit de request body direct, niet deze DB-waarde.
        const userMsgContent = improveDocument ? 'Aanvullende informatie ontvangen.' : message.trim();
        const { error: userMsgError } = await supabase
          .from('messages')
          .insert({ thread_id: activeThreadId, role: 'user', content: userMsgContent });

        if (userMsgError) {
          writeEvent(controller, { type: 'error', error: 'Bericht opslaan mislukt.' });
          controller.close();
          return;
        }

        // ── Berichtgeschiedenis ophalen + anonimiseren ─────────────────────────
        const { data: allMessages, error: messagesError } = await supabase
          .from('messages')
          .select('id, role, content')
          .eq('thread_id', activeThreadId)
          .order('created_at', { ascending: true });

        if (messagesError || !allMessages) {
          writeEvent(controller, { type: 'error', error: 'Berichten ophalen mislukt.' });
          controller.close();
          return;
        }

        // ── Kluis-retrieval ────────────────────────────────────────────────────
        // Voor de anonimisering, zodat de chunks meelopen in dezelfde request-map
        // als de berichtgeschiedenis. Overslaan als deze beurt alleen het
        // analyseblok gaat draaien (PDF's aanwezig, nog niet bevestigd).
        const userOnlyMessage = message.split(/\n\n\[(?:Bijlage|Transcript):/)[0].trim();

        // ── Write-intent detectie voor locaties ────────────────────────────────
        // Bevestigde writes gaan rechtstreeks naar /api/locations/chat-write (client-side),
        // dus locationWriteConfirmed kan hier nooit true zijn. Guard voor de volledigheid.
        const locationWriteConfirmed = body.locationWriteConfirmed === true;
        const locationsOn = tenant?.tenant_config?.features?.locations === true;

        let locationWriteConfirmSent = false;

        if (locationsOn && !locationWriteConfirmed) {
          const { data: locNamen } = await supabase
            .from('locations')
            .select('id, naam, bijzonderheden, parkeren, laden_lossen, vergunning_status, bereik, bereik_note, prijs, prijssoort, status, adres, omschrijving, doelgroep, channel, stad')
            .eq('tenant_id', tenant.id)
            .order('naam');

          if (locNamen?.length > 0) {
            const writeIntent = hasWriteIntent(userOnlyMessage);
            const hasLocMention = !writeIntent && locNamen.some(
              l => userOnlyMessage.toLowerCase().includes(l.naam.toLowerCase())
            );

            if (writeIntent || hasLocMention) {
              const recentUserMessages = allMessages
                .filter(m => m.role === 'user')
                .slice(-3, -1)
                .map(m => {
                  if (typeof m.content === 'string') return m.content;
                  if (Array.isArray(m.content)) {
                    return m.content.filter(c => c.type === 'text').map(c => c.text).join(' ');
                  }
                  return '';
                })
                .filter(Boolean);

              const intent = await parseWriteIntent(
                userOnlyMessage,
                locNamen.map(l => l.naam),
                client,
                recentUserMessages
              );

              if (intent) {
                const matchedLoc = locNamen.find(l => l.naam === intent.locatieNaam);
                if (matchedLoc) {
                  if (intent.modus === 'verwijder') {
                    const huidigeWaarde = matchedLoc[intent.veld] ?? '(leeg)';
                    writeEvent(controller, { type: 'chunk', text: `Hier is de huidige inhoud van **${intent.veld}** bij **${matchedLoc.naam}**:\n\n${huidigeWaarde}\n\nWat wil je hieruit verwijderen?` });
                    writeEvent(controller, { type: 'done', isDocument: false });
                    controller.close();
                    return;
                  }
                  const oudeWaarde = matchedLoc[intent.veld] ?? null;
                  writeEvent(controller, {
                    type: 'location_write_confirm',
                    locationId: matchedLoc.id,
                    locatieNaam: matchedLoc.naam,
                    veld: intent.veld,
                    oudeWaarde: oudeWaarde != null ? String(oudeWaarde) : null,
                    nieuweWaarde: intent.nieuweWaarde,
                    modus: intent.modus,
                  });
                  locationWriteConfirmSent = true;
                  controller.close();
                  return;
                }
              } else if (writeIntent) {
                // Haiku kon geen locatienaam of veld herkennen. Stuur vaste fallback, nooit model in.
                writeEvent(controller, { type: 'chunk', text: 'Ik kon geen locatienaam herkennen in dit verzoek. Bedoel je een specifieke locatie? Zeg dan bijvoorbeeld: "Zet bij [locatienaam] dat [nieuwe waarde]."' });
                writeEvent(controller, { type: 'done', isDocument: false });
                controller.close();
                return;
              }
              // hasLocMention && !intent: doorvallen naar model (mogelijk gewoon een vraag)
            }
          }
        }

        const hasUserContent = bodyHasUserContent !== false;

        // Vroege CSV + evaluatie-detectie: sla output_type op zodat threadOutputTypeFromDb gevuld is
        // voor de rest van de route. Wizard doet dit via request body; chat flow niet.
        const hasCsvFile = /\[bijlage:[^\]]*\.csv/i.test(message) || txtAttachments.some(a => /\.csv$/i.test(a.filename ?? ''));
        const hasEvalIntent = /\b(evaluatie|evaluation|rapport)\b/i.test(userOnlyMessage);
        if (!threadOutputTypeFromDb && hasCsvFile && hasEvalIntent) {
          await supabase.from('threads').update({ output_type: 'evaluation' }).eq('id', activeThreadId);
          threadOutputTypeFromDb = 'evaluation';
        }

        // effectiveOutputType: request → DB → auto-detectie → null
        // Vroeg berekend zodat isEvaluationType en skipVaultRetrieval kloppen vóór vault-retrieval
        let effectiveOutputType = outputType || threadOutputTypeFromDb;
        const hasGenerateIntent = /\b(maak|genereer)\b.{0,60}\b(briefing|evaluatie|rapport)\b|\b(maak\s+(de|hem|het|dit|haar))\b|\bdoe\s+het\s*(maar)?\b|\bbrief\w*\s+voor\s+\S/i.test(userOnlyMessage);
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
          else if (/\b(notulen|vergadersamenvatting|gesprekssamenvatting|meeting[\s-]samenvatting|samenvatting\s+van\s+(de\s+)?(vergadering|meeting|bespreking|call))\b/.test(recentText))
            effectiveOutputType = 'meeting-summary';
          else if (/\b(externe?\s+debrief|eindevaluatie|externe\s+evaluatie)\b/.test(recentText))
            effectiveOutputType = 'external-debrief';
          else if (/\b(evaluatie\s+maken|maak\s+een?\s+evaluatie|campagne[\s-]?evaluatie|sampling[\s-]?evaluatie)\b/i.test(recentText))
            effectiveOutputType = 'evaluation';
          if (!effectiveOutputType && hasGenerateIntent && (threadOutputTypeFromDb === 'recording' || outputType === 'recording' || recordingTranscript)) {
            effectiveOutputType = 'meeting-summary';
          }
          if (effectiveOutputType) {
            supabase.from('threads').update({ output_type: effectiveOutputType }).eq('id', activeThreadId).then(() => {});
          }
        }
        const isEvaluationType = effectiveOutputType === 'evaluation';
        const isFreeChat = !outputType && !hasGenerateIntent && !effectiveOutputType;
        // isExternalQuery: alleen expliciete mail-opstel of vertaal-verzoeken skippen vault.
        // Bij twijfel NIET skippen — vault raadplegen en niets vinden is beter dan een
        // kluisvraag missen. isFreeChat triggert vault NIET meer automatisch.
        const isExternalQuery = /\b(stel\s+een?\s+e?-?mail\s+op|schrijf\s+een?\s+e?-?mail|maak\s+een?\s+e?-?mail|vertaal\b|translate\b)/i.test(userOnlyMessage);
        // Vault overslaan als de gebruiker eigen content heeft aangeleverd:
        // analysisConfirmed (wizard/bevestiging) of eigen bestanden (PDF of Word/txt).
        const hasOwnContent = documentAttachments.length > 0 || txtAttachments.length > 0;
        const skipVaultRetrieval = analysisConfirmed || hasOwnContent || !hasUserContent || isEvaluationType || isExternalQuery;
        const vaultOn = vaultEnabled(tenant);

        const FULL_SUMMARY_KEYWORDS = ['volledige samenvatting', 'compleet overzicht', 'alle resultaten', 'hele document', 'volledig rapport'];
        const wantsFullSummary = FULL_SUMMARY_KEYWORDS.some(kw => userOnlyMessage.toLowerCase().includes(kw));

        // Brede meervoudsvraag: "onze evaluaties", "alle acties" etc. → meer chunks, lagere drempel
        const isBroadVaultQuery = /\b(onze|alle|meerdere|verschillende|elk|iedere)\b/i.test(userOnlyMessage) &&
          /\b(evaluaties|acties|resultaten|projecten|documenten|rapporten|campagnes|klanten|briefs|briefings)\b/i.test(userOnlyMessage);

        let vaultContext = { found: false, sources: [] };
        if (tenant?.id && vaultOn && !skipVaultRetrieval) {
          try {
            console.log('[VAULT-CALL] retrieveVaultContext aangeroepen voor query:', userOnlyMessage?.slice(0, 80), '| breed:', isBroadVaultQuery);
            vaultContext = await retrieveVaultContext({
              tenantId: tenant.id,
              query: userOnlyMessage,
              matchCount: isBroadVaultQuery ? 12 : 6,
              matchThreshold: isBroadVaultQuery ? 0.40 : 0.45,
              maxPerDocument: isBroadVaultQuery ? 3 : 2,
              broadQuery: isBroadVaultQuery,
            });
            if (wantsFullSummary && vaultContext.found) {
              const topDocId = vaultContext.sources[0].documentId;
              const fullDocContext = await retrieveFullDocument({ tenantId: tenant.id, documentId: topDocId });
              if (fullDocContext) {
                vaultContext = fullDocContext;
                console.log(`[VAULT] volledig document opgehaald: ${fullDocContext.sources.length} chunks`);
              }
            }
          } catch (err) {
            console.error('[VAULT] retrieval mislukt:', err?.message ?? err);
          }
        }

        const separator = `\n[---${crypto.randomUUID()}---]\n`;
        const combined = [
          ...allMessages.map(m => m.content),
          ...vaultContext.sources.map(s => s.content),
        ].join(separator);
        const { anonymized: anonAll, map } = isFreeChat ? { anonymized: combined, map: {} } : anonymize(combined);
        const anonParts = anonAll.split(separator);
        // Geanonimiseerde varianten van de kluis-chunks (zelfde map als de berichten).
        // Raakt de split misaligned, dan vervalt de chunk: liever geen context dan
        // ruwe content richting de provider.
        const anonVaultSources = vaultContext.sources
          .map((s, i) => ({ ...s, content: anonParts[allMessages.length + i] ?? null }))
          .filter((s) => s.content !== null);

        const userMessages = allMessages.filter(m => m.role === 'user');
        const isFirstTurn = userMessages.length === 1;

        // ── Stap 1 — Input normaliseren ────────────────────────────────────────

        // combinedUserContext: altijd op het hoogste niveau gebouwd, nooit binnen een if-blok
        // Bevat het geanonimiseerde laatste bericht inclusief ingebedde bijlagen
        const combinedUserContext = anonParts[allMessages.length - 1] ?? message.trim();

        // effectiveOutputType, hasGenerateIntent en auto-detectie zijn al berekend boven (vóór vault-retrieval)

        // isDocument: bepaalt of de stream gebufferd wordt (nooit live opbouwen)
        // effectiveOutputType uit de DB (threadOutputTypeFromDb) triggert document-modus alleen als er expliciete intentie is.
        const isDocument = hasGenerateIntent || isEvaluationType || (!!outputType && effectiveOutputType ? DOCUMENT_OUTPUT_TYPES.has(effectiveOutputType) : false);

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

        const hasSourceFiles = effectiveOutputType !== 'evaluation' && (
          documentAttachments.length > 0 ||
          ((effectiveOutputType === 'meeting-summary' || effectiveOutputType === 'field-briefing') && hasTxtContent)
        );
        if (hasSourceFiles && !analysisConfirmed && !improveDocument) {
          const ANALYSIS_TYPE_LABELS = {
            'account-to-pm':        'briefing naar PM',
            'account-to-creation':  'briefing naar creatie',
            'field-briefing':       'ambassadorsbriefing',
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

          const hasProjectName = !!(wizardProject?.trim() || threadProjectFromDb);
          const analysisClosingLine = hasProjectName
            ? `Op basis van wat ik zie, plan ik dit als ${docTypeLabel}. Klopt dat, of wil je iets anders?`
            : `Op basis van wat ik zie, plan ik dit als ${docTypeLabel}. Klopt dat, of wil je iets anders? En heb je al een projectnaam?`;

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
                    text: `Analyseer de aangeleverde bronnen voor een ${docTypeLabel}. Geen koptekst. Geen inleiding. Begin direct met de eerste bullet. Schrijf in precies dit formaat, in het Nederlands:\n\nWat me opvalt:\n- [punt 1, één zin]\n- [punt 2, één zin]\n- [punt 3 indien relevant, één zin]\n\nWat ik nog mis:\n- [punt 1, één zin]\n- [punt 2 indien relevant, één zin]\n\n${analysisClosingLine}\n\nHoud het compact. Geen extra uitleg.`,
                  },
                ],
              }],
            });
            const analysisText = analysisResp.content[0]?.text?.trim() ?? '';
            insertTokenUsage({
              tenantId: tenant?.id ?? null,
              userId: user.id,
              threadId: activeThreadId,
              requestType: 'chat-custom-analysis',
              model: 'claude-haiku-4-5-20251001',
              usage: analysisResp.usage,
            });
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

        if (effectiveOutputType === 'evaluation' || outputType === 'evaluation') {
          console.log('[EVAL] effectiveOutputType:', effectiveOutputType, '| outputType:', outputType, '| hasGenerateIntent:', hasGenerateIntent, '| docAtts:', documentAttachments.length, '| useStructuredPrompt:', useStructuredPrompt);
        }

        const structuredDocSystemPrompt = `Je bent een werk-AI bij een bureau. Jouw enige taak is het gevraagde document DIRECT en VOLLEDIG genereren. Je stelt GEEN vragen. Je weigert NOOIT. Begin direct met het document, geen inleiding.

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

Elke markering staat op een eigen regel. Nooit achter een zin. Nooit meerdere markeringen op één regel. Nooit een markering voor een veld dat wél is ingevuld.`;

        const systemPrompt = isFreeChat
          ? buildFreeChatSystemPrompt(firstName)
          : useStructuredPrompt && CUSTOM_SYSTEM_PROMPTS?.[effectiveOutputType]
            ? CUSTOM_SYSTEM_PROMPTS[effectiveOutputType]
            : useStructuredPrompt
              ? structuredDocSystemPrompt
              : CUSTOM_SYSTEM_PROMPT;

        // Kluiscontext alleen in conversatiemodus, als APART system-blok: het
        // statische promptdeel blijft dan cachebaar (cache_control), terwijl de
        // kluiscontext per request wisselt. In documentmodus gaat hij in promptText.
        let vaultSystemSuffix = '';
        if (!useStructuredPrompt) {
          if (vaultContext.found) {
            const proactiveInstruction = !wantsFullSummary
              ? `\n\nALS DE GEBRUIKER EEN SAMENVATTING VRAAGT: Vraagt de gebruiker om een samenvatting of overzicht van een document in de kluis zonder 'volledig', 'compleet', 'alle' of 'heel' te zeggen, reageer dan proactief met: 'Ik heb de volledige [naam van het document] in de kluis. Wil je dat ik daar een complete samenvatting van maak?'`
              : '';
            vaultSystemSuffix = `CONTEXT UIT DE KLUIS:\nHieronder staan fragmenten uit eerdere documenten en uploads van dit bureau, genummerd als bronnen. Gebruik ze alleen als ze relevant zijn voor het gesprek. Bij een concrete vraag (resultaten, aantallen, advies over een specifiek project): geef direct een kort, inhoudelijk antwoord op basis van wat je vindt — vraag niet eerst toestemming om een samenvatting te maken. Bied pas aan dieper in te gaan als het antwoord beknopt moest blijven door de hoeveelheid informatie. Dit is achtergrondcontext, geen input van de gebruiker. De fragmenten kunnen placeholders bevatten zoals [Naam 1], [EMAIL 1] of [TELEFOON 1]; behandel die als gewone waarden, neem ze letterlijk over waar relevant en benoem nooit dat informatie geanonimiseerd of een placeholder is.\n\nAls een bronfragment markeringen bevat zoals [UITZOEKEN INTERN], [AFSTEMMEN MET KLANT], [CIJFERS TOEVOEGEN] of [CHECK: ...], is die informatie onbevestigd — noem het als onzeker of laat het weg.\nAls je informatie uit een bron overneemt, benoem de bron dan inline met datum, bijvoorbeeld: "volgens de briefing van 7 juli" of "zoals beschreven in [naam document]". De datum staat in het bronblok als (datum).\n\nVERPLICHT AAN HET EINDE: Sluit je antwoord altijd af met exact deze regel (met de werkelijk gebruikte bronnummers ingevuld, kommagescheiden): [GEBRUIKTE_BRONNEN: N, N]. Neem een bron alleen op als je concrete inhoud (feiten, cijfers, citaten, specifieke punten) uit dat document hebt overgenomen in je antwoord. Als je een document alleen noemt om te zeggen dat het geen relevante informatie bevat, reken dat NIET als gebruikt en laat dat bronnummer weg. Deze regel wordt automatisch verwijderd en is nooit zichtbaar voor de gebruiker.\n\n${formatVaultBlock(anonVaultSources)}${proactiveInstruction}`;
          } else if (vaultOn && !skipVaultRetrieval) {
            vaultSystemSuffix = `KLUIS: er is in de kennisbank van het bureau gezocht naar context bij dit gesprek, maar er is niets relevants gevonden. Vraagt de gebruiker naar eerdere documenten, projecten of afspraken, zeg dan eerlijk dat je daarover niets in de kluis hebt gevonden. Verzin nooit eerdere documenten of afspraken.`;
          }
        }

        // ── Database-context (locaties + leveranciers) — tweelaags retrieval ───
        const databaseContextSuffix = await buildDatabaseContext(tenant, supabase, userOnlyMessage);

        // Verbetermodus: index en ID van het bestaande document-bericht alvast opzoeken
        // zodat Stap 4 het kan overschrijven in plaats van een nieuw bericht aan te maken.
        const existingDocMsgIdx = improveDocument
          ? [...allMessages].reduceRight(
              (found, m, i) => (found === -1 && m.role === 'assistant' ? i : found), -1
            )
          : -1;
        const existingDocMsgId = existingDocMsgIdx >= 0 ? (allMessages[existingDocMsgIdx].id ?? null) : null;

        let claudeMessages;
        if (useStructuredPrompt) {
          // Gebruikerstekst + bijlagen als input.
          // Evaluation: volledige context inclusief CSV-bijlagen meegeven (niet strippen).
          // Overige types: alleen gebruikerstekst, bijlagen via txtAttachments of transcript.
          let userTextOnly;
          if (effectiveOutputType === 'evaluation') {
            userTextOnly = combinedUserContext;
          } else {
            userTextOnly = recordingTranscriptContent
              ?? combinedUserContext.split(/\n\n\[(?:Bijlage|Transcript):/)[0].trim();

            if (txtAttachments.length > 0) {
              userTextOnly += '\n\n' + txtAttachments
                .map(t => `[Bijlage: ${t.filename}]\n${t.data}`)
                .join('\n\n');
            }
          }

          let promptText;
          if (improveDocument) {
            const anonExistingDoc = existingDocMsgIdx >= 0
              ? (anonParts[existingDocMsgIdx] ?? '')
              : '';

            promptText = `VERBETEROPDRACHT

Je verbetert een bestaand document met aanvullende informatie van de gebruiker. Pas de volgende regels mechanisch toe:
- Behoud de volledige structuur en alle bestaande inhoud letterlijk
- Vul [UITZOEKEN INTERN], [AFSTEMMEN MET KLANT] en [CIJFERS TOEVOEGEN] ALLEEN in als de aanvullende informatie de benodigde gegevens levert
- Laat markeringen die je niet kunt invullen exact staan zoals ze zijn
- Verzin niets en maak geen aannames die niet direct uit de aanvullende informatie volgen
- Lever het volledige verbeterde document op zonder inleiding, toelichting of commentaar
- Placeholders zoals [Naam 1] of [TELEFOON 1] behandel je als gewone waarden; benoem nooit dat iets geanonimiseerd is

BESTAAND DOCUMENT:
${anonExistingDoc}

AANVULLENDE INFORMATIE:
${userTextOnly}`;
          } else {
            promptText = CUSTOM_PROMPTS[effectiveOutputType](userTextOnly);
            if (vaultContext.found && !analysisConfirmed) {
              const proactiveInstruction = !wantsFullSummary
                ? `\n\nALS DE GEBRUIKER EEN SAMENVATTING VRAAGT: Vraagt de gebruiker om een samenvatting of overzicht van een document in de kluis zonder 'volledig', 'compleet', 'alle' of 'heel' te zeggen, reageer dan proactief met: 'Ik heb de volledige [naam van het document] in de kluis. Wil je dat ik daar een complete samenvatting van maak?'`
                : '';
              promptText = `CONTEXT UIT DE KLUIS - eerdere documenten van het bureau. Gebruik dit alleen waar de input ernaar verwijst of waar het een feitelijk gat in de input vult; vul je een gat vanuit deze context, markeer dat veld dan niet als ontbrekend. Dit is GEEN input van de gebruiker en mag de input nooit tegenspreken. Placeholders zoals [Naam 1] of [TELEFOON 1] behandel je als gewone waarden; benoem nooit dat iets geanonimiseerd is:\n\n${formatVaultBlock(anonVaultSources)}${proactiveInstruction}\n\n---\n\n` + promptText;
            }
            const effectiveClientName = clientName || threadClientFromDb;
            const effectiveProjectName = wizardProject?.trim() || threadProjectFromDb;
            if (effectiveClientName || effectiveProjectName) {
              const parts = [
                effectiveClientName ? `De klantnaam is "${effectiveClientName}".` : null,
                effectiveProjectName ? `De projectnaam is "${effectiveProjectName}".` : null,
              ].filter(Boolean).join(' ');
              promptText = `KRITIEKE REGEL: ${parts} Gebruik deze naam/namen EXACT zoals opgegeven in je volledige output, inclusief hoofdletters, koppeltekens en spelling. Schrijf ze NOOIT anders.\n\n` + promptText;
            }
          }
          // Verbetermodus: geen PDFs meesturen — die zijn al in de eerste generatie verwerkt;
          // de verbeterprompt bevat het bestaande document als tekstblok.
          const extraBlocks = improveDocument ? [] : [
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
        const streamParams = {
          model: 'claude-sonnet-4-6',
          max_tokens: effectiveOutputType === 'evaluation' ? 8192 : 4096,
          system: [
            { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
            ...(vaultSystemSuffix ? [{ type: 'text', text: vaultSystemSuffix }] : []),
            ...(databaseContextSuffix ? [{ type: 'text', text: databaseContextSuffix }] : []),
          ],
          messages: claudeMessages,
          ...(isDocument ? { temperature: 0 } : isFreeChat ? { temperature: 0.7 } : {}),
          ...(isFreeChat ? {
            tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
            betas: ['web-search-2025-03-05'],
          } : {}),
        };
        const claudeStream = isFreeChat
          ? client.beta.messages.stream(streamParams)
          : client.messages.stream(streamParams);

        for await (const chunk of claudeStream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            fullText += chunk.delta.text;
            writeEvent(controller, { type: 'chunk', text: chunk.delta.text });
          }
        }

        const finalMsg = await claudeStream.finalMessage();
        if (isFreeChat) {
          // Input is pas volledig na finalMessage() — niet tijdens content_block_start
          const searchBlocks = (finalMsg.content ?? []).filter(b => b.type === 'server_tool_use' && b.name === 'web_search');
          const resultBlocks = (finalMsg.content ?? []).filter(b => b.type === 'web_search_tool_result');
          console.log('[WEBSEARCH]', {
            used: searchBlocks.length > 0,
            queries: searchBlocks.map(b => b.input?.query ?? '(geen query)'),
            resultCounts: resultBlocks.map(b => Array.isArray(b.content) ? b.content.length : 0),
            threadId: activeThreadId,
          });
        }
        insertTokenUsage({
          tenantId: tenant?.id ?? null,
          userId: user.id,
          threadId: activeThreadId,
          requestType: 'chat-custom-generation',
          model: 'claude-sonnet-4-6',
          usage: finalMsg.usage,
        });

        const finalContent = deanonymize(fullText, map);

        // Extraheer de [GEBRUIKTE_BRONNEN: ...] lijst die Claude aan het einde plaatst.
        // Fallback: scan op eventuele losse (bron N) markers als het blok ontbreekt.
        const usedBronnenMatch = finalContent.match(/\[GEBRUIKTE_BRONNEN:\s*([\d,\s]+)\]/i);
        const _citedNrs = usedBronnenMatch
          ? new Set(usedBronnenMatch[1].split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n)))
          : new Set([...finalContent.matchAll(/\(bron\s+(\d+)\)/gi)].map(m => parseInt(m[1], 10)));
        const displayContent = finalContent
          .replace(/\[GEBRUIKTE_BRONNEN:[\d,\s]*\]\s*/gi, '')
          .replace(/\(bron\s+\d+\)/gi, '')
          .replace(/[ \t]{2,}/g, ' ')
          .trimEnd();

        // Evaluatie: extraheer JSON-blok uit de response voor de PowerPoint-flow
        let evaluationData = null;
        if (effectiveOutputType === 'evaluation') {
          const jsonMatch = finalContent.match(/```json\s*([\s\S]+?)\s*```/);
          if (jsonMatch) {
            try { evaluationData = JSON.parse(jsonMatch[1]); } catch { /* malformed JSON — skip */ }
          }
        }

        // ── Stap 4 — Opslaan ──────────────────────────────────────────────────
        let savedMsg;
        let updateSucceeded = false;
        if (improveDocument && existingDocMsgId) {
          // Verbetermodus: bestaand bericht overschrijven via service client — eigenaarschap
          // is al geverifieerd via de ownedThread-check eerder in de route; de user-client
          // heeft in streaming context geen betrouwbare auth.uid() voor de RLS-evaluatie.
          console.log('[VERBETER] stap 4 start — existingDocMsgId:', existingDocMsgId, '| thread:', activeThreadId, '| allMessages count:', allMessages.length, '| existingDocMsgIdx:', existingDocMsgIdx);
          const svc = createServiceClient();
          const { error: updateError } = await svc
            .from('messages')
            .update({ content: displayContent })
            .eq('id', existingDocMsgId);
          if (updateError) {
            console.error('[VERBETER] UPDATE mislukt:', updateError);
          } else {
            // Verifieer of de UPDATE daadwerkelijk een rij raakte
            const { data: verifyRows } = await svc
              .from('messages')
              .select('id')
              .eq('id', existingDocMsgId)
              .eq('content', displayContent)
              .limit(1);
            const verifyCount = verifyRows?.length ?? 0;
            updateSucceeded = verifyCount > 0;
            console.log('[VERBETER] UPDATE verify — rijen met nieuwe content:', verifyCount, '| updateSucceeded:', updateSucceeded);
          }
          if (updateSucceeded) {
            savedMsg = { id: existingDocMsgId };
            console.log('[VERBETER] UPDATE geslaagd — savedMsg.id:', existingDocMsgId);
          } else {
            // Fallback: nieuwe rij invoegen via service client (bypast RLS)
            console.warn('[VERBETER] UPDATE raakte 0 rijen — fallback INSERT via service client');
            const { data: insertData, error: insertError } = await svc
              .from('messages')
              .insert({ thread_id: activeThreadId, role: 'assistant', content: displayContent })
              .select('id')
              .single();
            if (insertError) console.error('[VERBETER] fallback INSERT mislukt:', insertError);
            else console.log('[VERBETER] fallback INSERT geslaagd — nieuw id:', insertData?.id);
            savedMsg = insertData;
          }
        } else {
          const { data, error } = await supabase
            .from('messages')
            .insert({ thread_id: activeThreadId, role: 'assistant', content: displayContent })
            .select('id')
            .single();
          if (error) console.error('[DB] assistant message opslaan mislukt:', error);
          savedMsg = data;
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
        if (evaluationData && savedMsg?.id) bgUpdate.field_briefing_extras = { [savedMsg.id]: evaluationData };
        await Promise.race([
          supabase.from('threads').update(bgUpdate).eq('id', activeThreadId)
            .then(
              ({ error }) => { if (error) console.error('[DB] bgUpdate failed:', error); },
              (err) => console.error('[DB] bgUpdate exception:', err)
            ),
          new Promise(resolve => setTimeout(resolve, 2000)),
        ]);

        // ── Kluis-ingest van gegenereerd document ─────────────────────────────
        // Alleen voor voltooide generaties, niet bij verbetering (apart document zou
        // de originele kluis-versie niet vervangen; dedup op content_hash vangt dit
        // grotendeels op maar skip is explicieter en goedkoper).
        if (tenant?.id && vaultOn && isDocument && savedMsg?.id && !improveDocument) {
          const cp = [detectedClient, detectedProject].filter(Boolean).join(' ');
          const generatedTitleMap = {
            'field-briefing':      cp ? `AMBASSADORSBRIEFING — ${cp}` : 'AMBASSADORSBRIEFING',
            'account-to-pm':       cp ? `BRIEFING NAAR PM — ${cp}` : 'BRIEFING NAAR PM',
            'account-to-creation': cp ? `BRIEFING NAAR CREATIE — ${cp}` : 'BRIEFING NAAR CREATIE',
            'meeting-summary':     cp ? `SAMENVATTING — ${cp}` : 'SAMENVATTING',
            'evaluation':          cp ? `Evaluatie — ${cp}` : 'Evaluatie',
            'external-debrief':    cp ? `EVALUATIE — ${cp}` : 'EVALUATIE',
            'project-briefing':    cp ? `PROJECTBRIEFING — ${cp}` : 'PROJECTBRIEFING',
          };
          const generatedTitle = generatedTitleMap[effectiveOutputType] ?? (cp ? `Document — ${cp}` : 'Gegenereerd document');
          await Promise.race([
            (async () => {
              try {
                const result = await ingestDocument({
                  tenantId: tenant.id,
                  userId: user.id,
                  threadId: activeThreadId,
                  title: generatedTitle,
                  sourceType: 'generated',
                  outputType: effectiveOutputType ?? null,
                  client: detectedClient ?? null,
                  project: detectedProject ?? null,
                  rawContent: displayContent,
                });
                if (!result.skipped) {
                  console.log('[VAULT] Document geingest:', generatedTitle, result.chunkCount, 'chunks');
                } else {
                  console.log('[VAULT] Document overgeslagen (dedup):', generatedTitle, result.reason);
                }
              } catch (err) {
                console.error('[VAULT] Document-ingest mislukt:', err?.message ?? err);
              }
            })(),
            new Promise(resolve => setTimeout(resolve, 15000)),
          ]);
        }

        // ── Kluis-ingest van PDF-bijlagen ─────────────────────────────────────
        // Na de generatie zodat de stream er niet op wacht. Await is verplicht:
        // fire-and-forget sterft in Vercel serverless. Dedup via content_hash.
        if (tenant?.id && vaultOn && documentAttachments.length > 0) {
          await Promise.race([
            (async () => {
              for (const doc of documentAttachments) {
                try {
                  const pdfText = await extractFileText(
                    Buffer.from(doc.data, 'base64'),
                    doc.filename || 'bijlage.pdf'
                  );
                  const result = await ingestDocument({
                    tenantId: tenant.id,
                    userId: user.id,
                    threadId: activeThreadId,
                    title: doc.filename || 'PDF-upload',
                    sourceType: 'upload',
                    client: detectedClient ?? null,
                    project: detectedProject ?? null,
                    rawContent: pdfText,
                  });
                  if (!result.skipped) {
                    console.log('[VAULT] PDF geingest:', doc.filename, result.chunkCount, 'chunks');
                  }
                } catch (err) {
                  console.error('[VAULT] PDF-ingest mislukt:', doc.filename, err?.message ?? err);
                }
              }
            })(),
            new Promise(resolve => setTimeout(resolve, 15000)),
          ]);
        }

        // Toon alleen bronnen die Claude daadwerkelijk heeft geciteerd (bron N markers).
        // Fallback voor naam-queries zonder citaties: alle opgehaalde bronnen tonen.
        // Brede queries zonder citaties: niets tonen (retrieval was al minder streng).
        if (vaultContext.found) {
          // Stap 1: filter op ORIGINELE bronnummers (voor dedup) zodat de indices kloppen
          // met wat Claude in de prompt heeft gezien.
          const citedRaw = _citedNrs.size > 0
            ? vaultContext.sources.filter((_, i) => _citedNrs.has(i + 1))
            : isBroadVaultQuery ? [] : vaultContext.sources;

          // Stap 2: dedup op documentId én titel — zelfde document kan meerdere keren
          // in de vault staan (origineel + verbeterde versie → verschillende IDs, zelfde titel).
          const seenKeys = new Set();
          const usedSources = citedRaw.filter(s => {
            const idKey = s.documentId;
            const titleKey = s.title?.toLowerCase().trim();
            if (idKey && seenKeys.has(idKey)) return false;
            if (titleKey && seenKeys.has(titleKey)) return false;
            if (idKey) seenKeys.add(idKey);
            if (titleKey) seenKeys.add(titleKey);
            return true;
          });

          if (usedSources.length > 0) {
            writeEvent(controller, {
              type: 'sources',
              sources: usedSources.map((s, i) => ({
                n: i + 1,
                title: s.title,
                client: s.client,
                project: s.project,
                createdAt: s.createdAt,
                sourceType: s.sourceType,
              })),
            });
          }
        }

        if (locationsOn && !locationWriteConfirmSent) {
          const FABRICATION_PATTERNS = [
            /locatiedatabase/i,
            /heb\s+(ik\s+)?(dit\s+)?vastgelegd/i,
            /heb\s+(ik\s+)?(dit\s+)?opgeslagen/i,
            /heb\s+(ik\s+)?(dit\s+)?bijgewerkt/i,
            /is\s+(nu\s+)?bijgewerkt\s+in/i,
            /is\s+(nu\s+)?opgeslagen\s+in/i,
          ];
          const hasFabricationClaim = FABRICATION_PATTERNS.some(p => p.test(displayContent));
          if (hasFabricationClaim) {
            writeEvent(controller, {
              type: 'chunk',
              text: '\n\n_(Let op: er zijn in dit gesprek geen wijzigingen doorgevoerd in de database. Gebruik "Zet bij [locatienaam] dat [nieuwe waarde]" om een locatie bij te werken.)_',
            });
          }
        }

        writeEvent(controller, {
          type: 'done',
          content: displayContent,
          messageId: savedMsg?.id ?? crypto.randomUUID(),
          improved: updateSucceeded,
          detectedClient,
          detectedProject,
          outputType: effectiveOutputType ?? null,
          // Corrigeer isDocument op basis van werkelijke content-structuur.
          // hasGenerateIntent kan true zijn terwijl Claude een verduidelijkingsvraag stelt.
          // looksLikeDocument vereist bold sectiekoppen of markdown headings — verduidelijkingsvragen
          // halen die drempel niet. Bij twijfel false: gemiste briefing is beter dan leeg document.
          isDocument: isDocument && looksLikeDocument(displayContent),
          ...(evaluationData ? { evaluationData } : {}),
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
