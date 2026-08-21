# Azure Whisper EU + Async Transcriptie — Implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Audio wordt nooit meer naar OpenAI US gestuurd. Whisper draait via Azure in West Europe. Transcriptie verloopt asynchroon via Inngest: de desktop-app is direct klaar na upload, het transcript verschijnt daarna in de webapp.

**Architecture:**
Desktop upload → `create-recording-thread` slaat audio op in Supabase Storage, maakt thread aan (status: queued), triggert Inngest event, retourneert direct. Inngest-functie draait op Vercel en roept Azure Whisper aan. Transcript wordt opgeslagen in Supabase. Webapp luistert via Realtime en toont het zodra het er is.

**Tech Stack:** Next.js 15, Supabase, Azure OpenAI Whisper (West Europe), Inngest (achtergrondtaken), openai@6 (AzureOpenAI class), Tauri 2 (desktop app)

## Global Constraints

- Audio verlaat nooit de EU: Azure deployment moet in regio `westeurope` (Nederland) of `swedencentral` staan met SKU `Data Zone Standard` (niet `Standard` global)
- Inngest-stappen retourneren nooit gevoelige content (transcript, audio-buffer): alleen status-strings. Alle data gaat rechtstreeks Vercel → Supabase, Inngest ziet alleen `{ status: 'ok' }`
- Als een opname groter is dan 25 MB: thread krijgt status `failed` met uitleg. Niet stil falen.
- De desktop-app toont nooit "Gelukt" als de thread niet bestaat in de database
- Lokaal audiobestand op de Mac wordt na upload niet verwijderd
- Niet pushen naar `main`. Werkt op de `staging`-branch, test op chase-staging

## Handmatige vereisten (niet in code)

Voordat de code werkt, moeten deze stappen handmatig gedaan worden in Azure portal:

1. Azure-abonnement + toegang aanvragen voor Azure OpenAI (AI Foundry in portal)
2. Azure OpenAI-resource aanmaken in regio `West Europe`
3. Model deployen: `whisper-1`, deployment-naam `whisper`, SKU **Data Zone Standard** (niet Standard global)
4. Endpoint-URL en API-key kopiëren
5. In Vercel-dashboard toevoegen:
   - `AZURE_OPENAI_ENDPOINT` = `https://<resource-name>.openai.azure.com`
   - `AZURE_OPENAI_API_KEY` = de Azure API-key (geen `sk-` prefix)
   - `AZURE_OPENAI_WHISPER_DEPLOYMENT` = `whisper`
6. `INNGEST_SIGNING_KEY` en `INNGEST_EVENT_KEY` uit Inngest-dashboard na aanmaken app

---

## File Structure

**Nieuw:**
- `lib/whisper.js` — Azure OpenAI client + `transcribeAudio()` + `filterHallucinations()`
- `lib/inngest.js` — Inngest client (singleton)
- `app/api/inngest/route.js` — Inngest webhook endpoint
- `inngest/functions/transcribe-recording.js` — achtergrondtaak
- `supabase/migrations/037_transcript_status.sql` — nieuwe kolom op threads

**Gewijzigd:**
- `app/api/transcribe/route.js` — importeert uit `lib/whisper.js`, zelfde interface
- `app/api/create-recording-thread/route.js` — verwijdert synchrone transcriptie, triggert Inngest
- Desktop `ui/index.html` — succes-melding bijgewerkt
- Webapp: thread-detail en sidebar (één component voor status-indicator)

---

## Task 1: lib/whisper.js — Azure-client en transcribeer-functie

**Files:**
- Create: `lib/whisper.js`
- Modify: `app/api/transcribe/route.js`

**Interfaces:**
- Produces: `transcribeAudio(file: File): Promise<string>` — geeft gefilterd transcript terug
- Produces: `filterHallucinations(text: string): string` — intern gebruik + export voor tests

- [ ] **Stap 1: schrijf de falende test**

Maak `__tests__/lib/whisper.test.js`:

```js
import { filterHallucinations } from '@/lib/whisper';

test('filtert Amara-ondertitels weg', () => {
  const input = 'Dag allemaal\nOndertiteld door de Amara.org-gemeenschap\nWelkom';
  expect(filterHallucinations(input)).toBe('Dag allemaal\nWelkom');
});

test('filtert herhaalde regels weg', () => {
  const input = 'Hallo\nHallo\nWereld';
  expect(filterHallucinations(input)).toBe('Hallo\nWereld');
});

test('lege input geeft lege string terug', () => {
  expect(filterHallucinations('')).toBe('');
});
```

- [ ] **Stap 2: draai test — verwacht FAIL** (`filterHallucinations is not a function`)

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa && npx jest __tests__/lib/whisper.test.js
```

- [ ] **Stap 3: schrijf `lib/whisper.js`**

```js
import { AzureOpenAI } from 'openai';

const HALLUCINATION_PATTERNS = [
  /ondertiteld door de amara\.org[- ]gemeenschap/i,
  /ondertitels ingediend door/i,
  /subtitles by the amara\.org community/i,
  /thanks for watching/i,
  /like and subscribe/i,
  /please subscribe/i,
  /transcription by eso\.?\s*translated by/i,
  /dutch subtitles by/i,
  /tv\s*gelderland/i,
  /omroep\s*gelderland/i,
  /nos\s*journaal/i,
  /ondertiteling\s*[:\-]?\s*npo/i,
  /ondertiteld\s*door/i,
  /ondertitels\s*door/i,
  /vertaald\s*door/i,
  /redactie\s*nederland/i,
  /made\s*by\s*[:\-]?\s*tv/i,
];

function normalizeLine(line) {
  return line.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

export function filterHallucinations(text) {
  if (!text) return text;
  const rawLines = text.split('\n');
  const filtered = [];
  for (const line of rawLines) {
    const t = line.trim();
    if (!t) continue;
    if (HALLUCINATION_PATTERNS.some((re) => re.test(t))) continue;
    const norm = normalizeLine(t);
    if (filtered.length > 0 && norm === normalizeLine(filtered[filtered.length - 1])) continue;
    filtered.push(t);
  }
  const deduped = [];
  for (let i = 0; i < filtered.length; i++) {
    if (i > 0 && normalizeLine(filtered[i]) === normalizeLine(filtered[i - 1])) continue;
    deduped.push(filtered[i]);
  }
  return deduped.join('\n').trim();
}

function createAzureClient() {
  return new AzureOpenAI({
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    apiVersion: '2024-05-01-preview',
    deployment: process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT ?? 'whisper',
  });
}

export async function transcribeAudio(file) {
  const client = createAzureClient();
  const result = await client.audio.transcriptions.create({
    file,
    model: process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT ?? 'whisper',
    language: 'nl',
  });
  return filterHallucinations(result.text);
}
```

- [ ] **Stap 4: draai test — verwacht PASS**

```bash
npx jest __tests__/lib/whisper.test.js
```

- [ ] **Stap 5: pas `app/api/transcribe/route.js` aan**

Vervang de `HALLUCINATION_PATTERNS`-blok en beide `new OpenAI(...)` instanties door imports:

```js
import { transcribeAudio, filterHallucinations } from '@/lib/whisper';
```

Verwijder `import OpenAI from 'openai'` bovenaan.

In `handleStoragePath`: vervang het Whisper-blok:
```js
// was:
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const result = await openai.audio.transcriptions.create({ file, model: 'whisper-1', language: 'nl' });
transcript = filterHallucinations(result.text);

// wordt:
transcript = await transcribeAudio(file);
```

In `handleDirectUpload`: zelfde vervanging.

- [ ] **Stap 6: controleer dat de route nog compileert**

```bash
npx tsc --noEmit 2>/dev/null || echo "geen TypeScript — OK"
node -e "require('./app/api/transcribe/route.js')" 2>&1 | head -5
```

- [ ] **Stap 7: commit**

```bash
git add lib/whisper.js app/api/transcribe/route.js __tests__/lib/whisper.test.js
git commit -m "feat: extract whisper logic to lib/whisper.js, switch to Azure OpenAI EU"
```

---

## Task 2: Supabase-migratie — transcript_status op threads

**Files:**
- Create: `supabase/migrations/037_transcript_status.sql`

**Interfaces:**
- Produces: kolom `transcript_status text NOT NULL DEFAULT 'done'` op `threads`
- Produces: kolom `transcript_error text` (nullable) op `threads`
- `DEFAULT 'done'`: bestaande threads hebben al een transcript, dus zijn klaar

- [ ] **Stap 1: schrijf de migratie**

```sql
-- 037_transcript_status.sql
ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS transcript_status text NOT NULL DEFAULT 'done'
    CHECK (transcript_status IN ('queued', 'processing', 'done', 'failed')),
  ADD COLUMN IF NOT EXISTS transcript_error text;
```

- [ ] **Stap 2: draai migratie lokaal**

```bash
supabase db push
```

Verwacht: `done` zonder errors.

- [ ] **Stap 3: verifieer**

```bash
supabase db diff --schema public | grep transcript
```

Verwacht: twee nieuwe kolommen zichtbaar.

- [ ] **Stap 4: commit**

```bash
git add supabase/migrations/037_transcript_status.sql
git commit -m "feat: add transcript_status and transcript_error to threads"
```

---

## Task 3: Inngest setup

**Files:**
- Create: `lib/inngest.js`
- Create: `app/api/inngest/route.js`
- Create: `inngest/functions/transcribe-recording.js`
- Modify: `package.json` (via npm install)

**Interfaces:**
- Produces: `inngest` (singleton client) exporteerd vanuit `lib/inngest.js`
- Produces: event `recording/transcribe` met payload `{ threadId, storagePath, userId }`
- Produces: webhook op `POST /api/inngest`

- [ ] **Stap 1: installeer Inngest**

```bash
npm install inngest
```

- [ ] **Stap 2: schrijf `lib/inngest.js`**

```js
import { Inngest } from 'inngest';
export const inngest = new Inngest({ id: 'oyaa' });
```

- [ ] **Stap 3: schrijf de achtergrondtaak `inngest/functions/transcribe-recording.js`**

Privacy: stappen retourneren alleen `{ status: 'ok' }`, nooit het transcript. Transcript gaat rechtstreeks Vercel → Supabase.

```js
import { inngest } from '@/lib/inngest';
import { transcribeAudio } from '@/lib/whisper';
import { createServiceClient } from '@/lib/supabase-server';

const MAX_SIZE = 25 * 1024 * 1024; // 25MB — Whisper API-limiet

export const transcribeRecording = inngest.createFunction(
  { id: 'transcribe-recording', retries: 2 },
  { event: 'recording/transcribe' },
  async ({ event, step }) => {
    const { threadId, storagePath } = event.data;

    await step.run('mark-processing', async () => {
      const supabase = createServiceClient();
      await supabase
        .from('threads')
        .update({ transcript_status: 'processing' })
        .eq('id', threadId);
      return { status: 'ok' };
    });

    await step.run('transcribe-and-save', async () => {
      const supabase = createServiceClient();

      const { data: blob, error: dlErr } = await supabase.storage
        .from('recordings')
        .download(storagePath);
      if (dlErr) throw new Error(`Download mislukt: ${dlErr.message}`);

      const buffer = await blob.arrayBuffer();
      if (buffer.byteLength > MAX_SIZE) {
        await supabase
          .from('threads')
          .update({
            transcript_status: 'failed',
            transcript_error: `Audio (${Math.round(buffer.byteLength / 1024 / 1024)} MB) is groter dan 25 MB. Splits de opname en probeer opnieuw.`,
          })
          .eq('id', threadId);
        return { status: 'ok' };
      }

      let transcript;
      try {
        const file = new File([buffer], 'recording.m4a', { type: 'audio/mp4' });
        transcript = await transcribeAudio(file);
      } catch (err) {
        await supabase
          .from('threads')
          .update({
            transcript_status: 'failed',
            transcript_error: `Transcriptie mislukt: ${err?.message ?? 'onbekende fout'}`,
          })
          .eq('id', threadId);
        return { status: 'ok' };
      }

      await supabase.from('messages').insert({
        thread_id: threadId,
        role: 'user',
        content: transcript,
        attachments: [],
      });

      await supabase
        .from('threads')
        .update({ transcript_status: 'done', transcript_error: null })
        .eq('id', threadId);

      // Transcript nooit teruggeven — blijft in Supabase, niet in Inngest memostate
      return { status: 'ok' };
    });
  }
);
```

- [ ] **Stap 4: schrijf `app/api/inngest/route.js`**

```js
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';
import { transcribeRecording } from '@/inngest/functions/transcribe-recording';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [transcribeRecording],
});
```

- [ ] **Stap 5: voeg env vars toe aan `.env.local`** (alleen lokaal, Vercel krijgt ze apart)

```
INNGEST_SIGNING_KEY=<uit Inngest-dashboard>
INNGEST_EVENT_KEY=<uit Inngest-dashboard>
```

- [ ] **Stap 6: start Inngest Dev Server lokaal en verifieer dat de functie zichtbaar is**

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Open `http://localhost:8288` — `transcribe-recording` moet zichtbaar zijn onder Functions.

- [ ] **Stap 7: commit**

```bash
git add lib/inngest.js app/api/inngest/route.js inngest/functions/transcribe-recording.js package.json package-lock.json
git commit -m "feat: add Inngest client and transcribe-recording background function"
```

---

## Task 4: create-recording-thread aanpassen — synchrone transcriptie eruit

**Files:**
- Modify: `app/api/create-recording-thread/route.js`

**Interfaces:**
- Response verandert: `{ threadId, title }` (geen `transcript` of `audioWarning` meer)
- Triggert event `recording/transcribe` met `{ threadId, storagePath, userId }`

- [ ] **Stap 1: schrijf de falende test**

`__tests__/api/create-recording-thread.test.js`:

```js
// Smoke-test: route retourneert direct zonder op transcript te wachten
// Dit is een integratietest — sla over als jest niet geconfigureerd is voor API-routes
// Handmatig testen via curl of Postman na deploy naar staging
test.todo('route retourneert threadId direct zonder transcript in response');
```

(Volledige integratietest is te zwaar voor unit-test hier — de echte test is de desktop-upload naar staging.)

- [ ] **Stap 2: herschrijf `app/api/create-recording-thread/route.js`**

Verwijder:
- De `fetch('/api/transcribe', ...)` call en alles wat daarna met het transcript doet
- De `transcript` en `transcribeError` variabelen
- De `audioWarning` variabele en het try/catch blok dat dat zet (storage-upload blijft)

Voeg toe:
- `import { inngest } from '@/lib/inngest';`
- Thread aanmaken met `transcript_status: 'queued'`
- Geen message insert (dat doet Inngest na transcriptie)
- Inngest-event sturen na de storage-upload

Het volledige bestand na de aanpassing:

```js
export const maxDuration = 60; // geen transcriptie meer, hoeft niet 120s te zijn

import { createClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';
import { inngest } from '@/lib/inngest';

function pad(n) { return String(n).padStart(2, '0'); }

function recordingTitle(client) {
  const now = new Date();
  const date = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;
  return client ? `Meeting transcript — ${client} — ${date}` : `Meeting transcript — ${date}`;
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const tenant = await getTenant();

  let formData;
  try { formData = await request.formData(); }
  catch { return Response.json({ error: 'Ongeldig verzoek.' }, { status: 400 }); }

  const audioFile = formData.get('audio');
  if (!audioFile) return Response.json({ error: 'Geen audiobestand.' }, { status: 400 });

  const client = formData.get('client') || null;
  const project = formData.get('project') || null;

  // Upload audio naar Supabase Storage
  const ext = audioFile.name?.split('.').pop() || 'm4a';
  const storagePath = `${user.id}/${Date.now()}.${ext}`;
  const audioBuffer = await audioFile.arrayBuffer();

  const { error: storageError } = await supabase.storage
    .from('recordings')
    .upload(storagePath, audioBuffer, {
      contentType: audioFile.type || 'audio/mp4',
      upsert: false,
    });

  if (storageError) {
    return Response.json(
      { error: `Audio opslaan mislukt: ${storageError.message}` },
      { status: 500 }
    );
  }

  // Thread aanmaken
  const title = recordingTitle(client);
  const { data: thread, error: threadError } = await supabase
    .from('threads')
    .insert({
      user_id: user.id,
      tenant_id: tenant?.id ?? null,
      title,
      output_type: 'recording',
      client: client || null,
      project: project || null,
      transcript_status: 'queued',
    })
    .select('id')
    .single();

  if (threadError) {
    // Ruim storage op als thread aanmaken mislukt
    await supabase.storage.from('recordings').remove([storagePath]).catch(() => {});
    return Response.json({ error: 'Thread aanmaken mislukt.' }, { status: 500 });
  }

  // Inngest-event sturen — transcriptie loopt op de achtergrond
  await inngest.send({
    name: 'recording/transcribe',
    data: { threadId: thread.id, storagePath, userId: user.id },
  });

  return Response.json({ threadId: thread.id, title });
}
```

- [ ] **Stap 3: controleer compilatie**

```bash
node --input-type=module < app/api/create-recording-thread/route.js 2>&1 | head -10
```

- [ ] **Stap 4: commit**

```bash
git add app/api/create-recording-thread/route.js
git commit -m "feat: create-recording-thread returns immediately, triggers Inngest for transcription"
```

---

## Task 5: Desktop app — succes-melding bijwerken

**Files:**
- Modify: `/Users/caesardriessen/Desktop/Github/waybetter-desktop-tauri/ui/index.html`

**Context:** De route retourneert nu `{ threadId, title }`, geen `transcript` meer. De succes-melding moet dit reflecteren.

- [ ] **Stap 1: zoek de huidige succes-melding op in `ui/index.html`**

Zoek naar `showUploadSuccess` en het element `#upload-success`.

- [ ] **Stap 2: pas de succes-melding aan**

De huidige tekst suggereert dat het verwerkt is. Vervang dat zodat duidelijk is dat het transcript nog volgt:

```
Opname geüpload
Transcriptie loopt op de achtergrond — open de link om de voortgang te zien.
```

De knop "Open in browser" blijft. De `#audio-warning` sectie voor de opslag-waarschuwing kan ook blijven, maar de `audioWarning`-logica vervalt (de route stuurt dat niet meer terug).

- [ ] **Stap 3: pas `showUploadSuccess` aan in de JS-sectie**

Verwijder de `warning`-parameter en de `#audio-warning` logica. De functie toont alleen de link.

```js
function showUploadSuccess(title, url) {
  document.getElementById('upload-state').style.display = 'none';
  const s = document.getElementById('upload-success');
  s.style.display = 'block';
  document.getElementById('success-title').textContent = title || 'Opname geüpload';
  threadUrl = url;
}
```

En in de upload-handler, waar de response verwerkt wordt:

```js
// was: showUploadSuccess(result.title, url, result.audioWarning)
// wordt:
showUploadSuccess(result.title, `https://${hostname}/app?thread=${result.threadId}`);
```

- [ ] **Stap 4: test lokaal**

Start de Tauri dev-app en doe een testopname. Controleer:
- App toont de nieuwe tekst
- Link opent de webapp op de juiste thread-URL
- Geen console-errors over ontbrekende velden

- [ ] **Stap 5: commit**

```bash
cd /Users/caesardriessen/Desktop/Github/waybetter-desktop-tauri
git add ui/index.html
git commit -m "feat: update upload success message for async transcription"
```

---

## Task 6: Webapp — transcript_status tonen in thread-detail

**Files:**
- Modify: relevante thread-detail component (locatie opzoeken: waarschijnlijk `app/app/threads/[id]/page.js` of de chat-view)

**Interfaces:**
- Leest `transcript_status` van het thread-object
- Supabase Realtime subscription op `threads` tabel voor de huidige thread-id

- [ ] **Stap 1: zoek de thread-detail view op**

```bash
find /Users/caesardriessen/Desktop/Github/oyaa/app -name "*.js" -o -name "*.jsx" | xargs grep -l "thread_id\|threadId" | head -10
```

- [ ] **Stap 2: voeg status-indicator toe**

In de component die het transcript toont: check `thread.transcript_status` vóórdat je de berichten rendert.

```jsx
{thread.transcript_status === 'queued' && (
  <div className="transcript-pending">
    Transcriptie staat in de wachtrij...
  </div>
)}
{thread.transcript_status === 'processing' && (
  <div className="transcript-pending">
    Bezig met transcriberen...
  </div>
)}
{thread.transcript_status === 'failed' && (
  <div className="transcript-failed">
    <p>Transcriptie mislukt: {thread.transcript_error}</p>
    {/* Retry-knop: roept /api/retry-transcription aan — dat is een apart ticket */}
  </div>
)}
```

- [ ] **Stap 3: voeg Supabase Realtime subscription toe**

```js
useEffect(() => {
  if (thread.transcript_status === 'done') return; // niets te wachten

  const channel = supabase
    .channel(`thread-status-${thread.id}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'threads',
      filter: `id=eq.${thread.id}`,
    }, (payload) => {
      if (payload.new.transcript_status === 'done') {
        router.refresh(); // herlaad de pagina om transcript en berichten op te halen
      }
      if (payload.new.transcript_status === 'failed') {
        router.refresh();
      }
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [thread.id, thread.transcript_status]);
```

- [ ] **Stap 4: test end-to-end op staging**

Upload een korte opname via de desktop-app. Controleer:
1. Desktop toont "Opname geüpload" + link direct na upload
2. Webapp opent en toont "Transcriptie staat in de wachtrij..."
3. Na 30-60 seconden: transcript verschijnt automatisch

- [ ] **Stap 5: commit**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa
git add <gewijzigde bestanden>
git commit -m "feat: show transcript_status in thread view with Realtime update"
```

---

## Deploy-workflow

Na elke task:
1. `git push origin feature/azure-whisper-async` (of de huidige feature-branch)
2. Merge naar `staging` en push
3. Bevestig commit-hash op staging

Vercel env vars voor staging toevoegen voordat Task 1 getest wordt:
- `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_WHISPER_DEPLOYMENT`
- `INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY`
