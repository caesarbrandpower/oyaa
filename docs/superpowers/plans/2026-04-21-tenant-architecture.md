# Tenant Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vervang de hardcoded ChaseBadge-aanpak door een schaalbare multi-tenant structuur met een Supabase `tenants` tabel, Next.js middleware voor hostname-detectie, en een AllDay-specifieke UI met 3 outputtypen en een ontvangersselector.

**Architecture:** Middleware extraheert de hostname en zet die als `x-tenant-hostname` request-header. `app/page.js` (server component, al `force-dynamic`) leest die header via `lib/get-tenant.js` en haalt de tenant-config op uit Supabase. De juiste form-component (`PublicTranscriptForm` voor default/Chase, `AllDayTranscriptForm` voor AllDay) wordt doorgegeven als prop-vrij server-side gekozen child. `ChaseBadge` vervalt; `TenantBadge` rendert per-tenant logo op basis van `logo_url`.

**Tech Stack:** Next.js 15 App Router, Supabase (service role client), Tailwind CSS, `@supabase/supabase-js`

---

## File Map

| File | Status | Verantwoordelijkheid |
|------|--------|----------------------|
| `supabase/migrations/002_create_tenants.sql` | Nieuw | Tenants tabel + RLS + seed voor 3 tenants |
| `middleware.js` | Nieuw | Hostname extractie, zet `x-tenant-hostname` header |
| `lib/get-tenant.js` | Nieuw | Server utility: leest header, haalt tenant op uit Supabase |
| `lib/prompts.js` | Wijzig | Voeg AllDay-prompts toe: `allday-samenvatting`, `allday-briefing`, `allday-debrief` |
| `app/api/chat/route.js` | Wijzig | Accepteer optionele `recipient` parameter, geef door aan prompt |
| `components/TenantBadge.jsx` | Nieuw | Server component, rendert branded header op basis van `tenant.logo_url` |
| `components/AllDayTranscriptForm.jsx` | Nieuw | Client component: 3 outputtypen + ontvangersselector, AllDay UI |
| `app/page.js` | Wijzig | Async server component, haalt tenant op, kiest juiste form + TenantBadge |
| `components/ChaseBadge.jsx` | Verwijder | Vervangen door TenantBadge |

**Niet aangeraakt:** `components/PublicTranscriptForm.jsx`, `components/TranscriptForm.jsx`, `app/(authenticated)/`, `app/api/transcribe/`, `lib/use-audio.js`, `lib/storage-upload.js`, database schema voor projects/outputs.

---

## Task 1: Database — tenants tabel + seed

**Files:**
- Maak aan: `supabase/migrations/002_create_tenants.sql`

**Let op:** Dit bestand is een lokaal referentiedocument. De SQL moet je handmatig uitvoeren in het Supabase dashboard (SQL Editor). Er is geen automatische migratie-runner ingesteld.

- [ ] **Step 1: Maak de migratiefile aan**

Inhoud van `supabase/migrations/002_create_tenants.sql`:

```sql
-- Tenants table
create table public.tenants (
  id uuid default gen_random_uuid() primary key,
  hostname text not null unique,
  name text not null,
  logo_url text,
  primary_color text not null default '#FF4800',
  enabled_output_types jsonb not null default '[]'::jsonb,
  tenant_config jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now() not null
);

-- Enable RLS
alter table public.tenants enable row level security;

-- Tenant config is public read — geen auth nodig voor branding ophalen
create policy "Tenants are publicly readable"
  on public.tenants for select
  using (true);

-- Seed: waybetter.nl (default)
insert into public.tenants (hostname, name, logo_url, primary_color, enabled_output_types, tenant_config)
values (
  'waybetter.nl',
  'Waybetter',
  null,
  '#FF4800',
  '["summary-actions","internal-briefing","external-debrief","internal-actions","external-actions","project-planning","supplier-briefing","staff-planning","client-status"]'::jsonb,
  '{}'::jsonb
);

-- Seed: chase.waybetter.nl
insert into public.tenants (hostname, name, logo_url, primary_color, enabled_output_types, tenant_config)
values (
  'chase.waybetter.nl',
  'Chase',
  'https://www.chase.amsterdam/content/themes/chase/images/chase-brand-activation-white.svg',
  '#FF4800',
  '["summary-actions","internal-briefing","external-debrief","internal-actions","external-actions","project-planning","supplier-briefing","staff-planning","client-status"]'::jsonb,
  '{}'::jsonb
);

-- Seed: allday.waybetter.nl
-- Pas logo_url aan naar de juiste URL van wedothisallday.com na het uitvoeren van deze migratie
insert into public.tenants (hostname, name, logo_url, primary_color, enabled_output_types, tenant_config)
values (
  'allday.waybetter.nl',
  'All Day',
  null,
  '#FF4800',
  '["allday-samenvatting","allday-briefing","allday-debrief"]'::jsonb,
  '{"recipients":["team","klant","leverancier","directie"]}'::jsonb
);
```

- [ ] **Step 2: Voer de SQL uit in Supabase dashboard**

Ga naar Supabase → SQL Editor → plak de inhoud van `002_create_tenants.sql` → Run.

Verwacht: geen errors, tabel `tenants` zichtbaar onder Table Editor met 3 rijen.

- [ ] **Step 3: Verifieer de tabel**

Voer in SQL Editor uit:

```sql
select hostname, name, logo_url, jsonb_array_length(enabled_output_types) as num_types
from public.tenants
order by created_at;
```

Verwacht:

| hostname | name | logo_url | num_types |
|----------|------|----------|-----------|
| waybetter.nl | Waybetter | null | 9 |
| chase.waybetter.nl | Chase | https://... | 9 |
| allday.waybetter.nl | All Day | null | 3 |

- [ ] **Step 4: Update AllDay logo URL**

Ga naar wedothisallday.com, open DevTools, zoek de logo URL (rechtsklik op het logo → Inspect). Voer in Supabase SQL Editor:

```sql
update public.tenants
set logo_url = 'PLAK_HIER_DE_ECHTE_LOGO_URL'
where hostname = 'allday.waybetter.nl';
```

- [ ] **Step 5: Commit de migratiefile**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa
git add supabase/migrations/002_create_tenants.sql
git commit -m "feat: add tenants migration — hostname-based tenant config table"
```

---

## Task 2: Middleware — hostname extractie

**Files:**
- Maak aan: `middleware.js` (projectroot, naast `package.json`)

De middleware extraheert alleen de hostname en zet die als header. Geen Supabase-call hier. Houdt de middleware simpel en snel (edge runtime).

- [ ] **Step 1: Maak `middleware.js` aan**

```javascript
import { NextResponse } from 'next/server';

export function middleware(request) {
  const host = request.headers.get('host') || '';
  // Strip port voor lokale dev (localhost:3000 → localhost)
  const hostname = host.replace(/:\d+$/, '');

  const response = NextResponse.next();
  response.headers.set('x-tenant-hostname', hostname);
  return response;
}

export const config = {
  // Alle pagina-requests, maar niet static assets of API-routes
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|sw.js|manifest.json|icon-).*)'],
};
```

- [ ] **Step 2: Verifieer dat de build nog werkt**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa && npm run build 2>&1 | grep -E "(error|Error|compiled|failed)" | head -10
```

Verwacht: geen errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa
git add middleware.js
git commit -m "feat: add middleware — extract hostname as x-tenant-hostname header"
```

---

## Task 3: Server utility — get-tenant.js

**Files:**
- Maak aan: `lib/get-tenant.js`

Leest de `x-tenant-hostname` header (gezet door middleware) en haalt de tenant op uit Supabase. Valt terug op de waybetter.nl default als de hostname niet gevonden wordt.

- [ ] **Step 1: Maak `lib/get-tenant.js` aan**

```javascript
import { headers } from 'next/headers';
import { createServiceClient } from './supabase-server';

const DEFAULT_HOSTNAME = 'waybetter.nl';

/**
 * Haalt de tenant-config op voor de huidige request op basis van hostname.
 * Gebruikt de service role client (bypasses RLS).
 * Valt terug op waybetter.nl als de hostname niet gevonden wordt.
 *
 * @returns {Promise<Object>} Tenant record uit de tenants tabel
 */
export async function getTenant() {
  const headersList = await headers();
  const hostname = headersList.get('x-tenant-hostname') || DEFAULT_HOSTNAME;

  const supabase = createServiceClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('hostname', hostname)
    .single();

  if (tenant) return tenant;

  // Fallback: default tenant
  const { data: defaultTenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('hostname', DEFAULT_HOSTNAME)
    .single();

  return defaultTenant ?? null;
}
```

- [ ] **Step 2: Verifieer build**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa && npm run build 2>&1 | grep -E "(error|Error|compiled|failed)" | head -10
```

Verwacht: geen errors (het bestand wordt nog niet geimporteerd, heeft geen effect op build).

- [ ] **Step 3: Commit**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa
git add lib/get-tenant.js
git commit -m "feat: add get-tenant — server utility for hostname-based tenant lookup"
```

---

## Task 4: AllDay prompts + API recipient parameter

**Files:**
- Wijzig: `lib/prompts.js`
- Wijzig: `app/api/chat/route.js`

Voeg drie AllDay-prompts toe die een optionele `recipient` parameter accepteren. De bestaande 9 prompts nemen één argument (`transcript`) en blijven ongewijzigd. Update de chat API route om `recipient` door te sturen.

- [ ] **Step 1: Voeg AllDay-types toe aan `OUTPUT_TITLES` in `lib/prompts.js`**

Voeg toe aan het `OUTPUT_TITLES` object (na `'client-status'`):

```javascript
export const OUTPUT_TITLES = {
  'summary-actions': 'Samenvatting met actiepunten',
  'summary-actions-internal': 'Samenvatting (intern)',
  'summary-actions-external': 'Samenvatting (extern)',
  'internal-briefing': 'Interne briefing',
  'external-debrief': 'Externe debrief naar klant',
  'internal-actions': 'Actiepunten intern',
  'external-actions': 'Actiepunten extern',
  'project-planning': 'Projectplanning aanzet',
  'supplier-briefing': 'Leveranciersbriefing',
  'staff-planning': 'Personeelsplanning',
  'client-status': 'Statusupdate klant',
  // AllDay types
  'allday-samenvatting': 'Samenvatting',
  'allday-briefing': 'Briefing',
  'allday-debrief': 'Debrief',
};
```

- [ ] **Step 2: Voeg de drie AllDay-prompts toe aan `PROMPTS` in `lib/prompts.js`**

Voeg toe aan het einde van het `PROMPTS` object (voor de sluitende `}`):

```javascript
  'allday-samenvatting': (transcript, recipient = 'team') => {
    const contextByRecipient = {
      team: 'voor het interne team. Gebruik namen, eigenaren en interne details vrij. Sluit af met concrete actiepunten per persoon.',
      klant: 'voor de klant. Gebruik geen interne namen of jargon. Verwijs naar "het team" of "wij". Toon alleen wat voor de klant relevant is.',
      leverancier: 'voor een externe leverancier of freelancer. Focus op de opdracht, de context en de afspraken die voor hen relevant zijn.',
      directie: 'voor de directie. Maximaal 150 woorden. Kern: wat is besloten, wat staat nog open, wat zijn de acties.',
    };
    const context = contextByRecipient[recipient] || contextByRecipient.team;
    return `Je bent een scherpe collega bij een evenementenbureau. Schrijf een heldere samenvatting van dit gesprek, ${context}

Regels:
- Schrijf actief en direct. Geen ambtelijke zinnen.
- Gebruik thematische kopjes bij gesprekken met meerdere onderwerpen.
- Neem alle inhoudelijk relevante onderwerpen mee.
- Sluit af met actiepunten in bullet points.

Transcript:
${transcript}

Schrijf in helder, direct Nederlands.`;
  },

  'allday-briefing': (transcript, recipient = 'team') => {
    const structureByRecipient = {
      team: `Gebruik deze structuur:
**Achtergrond** -- Wie, wat, waarom?
**Doel** -- Wat moet het resultaat zijn?
**Scope** -- Wat valt er wel en niet onder?
**Deadlines** -- Welke data zijn besproken?
**Afspraken** -- Wat is exact afgesproken?
**Acties** -- Wie doet wat?`,
      klant: `Gebruik deze structuur:
**Opdrachtomschrijving** -- Wat gaan we doen?
**Doelstelling** -- Wat willen we bereiken?
**Aanpak** -- Hoe pakken we het aan?
**Planning** -- Wanneer gebeurt wat?
**Volgende stappen** -- Wat verwachten we van de klant?`,
      leverancier: `Gebruik deze structuur:
**Opdrachtomschrijving** -- Wat moet er gebeuren?
**Specificaties** -- Technische of praktische eisen
**Tijdlijn** -- Wanneer moet het klaar zijn?
**Contactpersoon** -- Wie is het aanspreekpunt?
**Afspraken** -- Wat is er financieel of praktisch afgesproken?`,
      directie: `Gebruik deze structuur:
**Kern** -- Waar gaat het over (maximaal 2 zinnen)
**Beslissingen** -- Wat is besloten?
**Risico's** -- Wat zijn de aandachtspunten?
**Acties** -- Wie doet wat en wanneer?`,
    };
    const recipientLabel = {
      team: 'het interne team',
      klant: 'de klant',
      leverancier: 'de leverancier of freelancer',
      directie: 'de directie',
    };
    const structure = structureByRecipient[recipient] || structureByRecipient.team;
    const label = recipientLabel[recipient] || recipientLabel.team;
    return `Je bent een ervaren accountmanager bij een evenementenbureau. Maak op basis van dit transcript een heldere briefing voor ${label}.

${structure}

Als informatie voor een sectie niet in het transcript staat, schrijf dan: "Niet besproken."

Transcript:
${transcript}

Schrijf in professioneel Nederlands.`;
  },

  'allday-debrief': (transcript, recipient = 'team') => {
    const contextByRecipient = {
      team: 'een interne debrief voor het team na afloop van een gesprek of project. Focus op wat goed ging, wat beter kon en de vervolgacties.',
      klant: 'een professionele externe debrief naar de klant. Vat de bespreking samen, bevestig beslissingen en geef de vervolgstappen. Toon is positief en bevestigend.',
      leverancier: 'een debrief naar de leverancier of freelancer. Benoem wat geleverd is, geef feedback op de samenwerking en sluit af met eventuele vervolgafspraken.',
      directie: 'een managementdebrief voor de directie. Maximaal 150 woorden. Kern: wat is bereikt, wat staat nog open, wat zijn de acties.',
    };
    const context = contextByRecipient[recipient] || contextByRecipient.team;
    return `Je bent een ervaren accountmanager bij een evenementenbureau. Schrijf ${context}

Gebruik deze structuur:
**Samenvatting** -- Wat is er besproken of gedaan?
**Genomen beslissingen** -- Wat is er besloten?
**Vervolgstappen** -- Wie doet wat en wanneer?
**Open punten** -- Wat moet nog worden uitgezocht of bevestigd?

Als informatie voor een sectie niet in het transcript staat, schrijf dan: "Niet besproken."

Transcript:
${transcript}

Schrijf in professioneel Nederlands.`;
  },
```

- [ ] **Step 3: Update `app/api/chat/route.js`**

Vervang de huidige `route.js` volledig door:

```javascript
import Anthropic from '@anthropic-ai/sdk';
import { anonymize, deanonymize } from '@/lib/anonymize';
import { PROMPTS } from '@/lib/prompts';

export async function POST(request) {
  const { transcript, outputType, projectId, recipient } = await request.json();

  if (!transcript || !transcript.trim()) {
    return Response.json({ error: 'Transcript is verplicht.' }, { status: 400 });
  }

  if (!outputType || !PROMPTS[outputType]) {
    return Response.json({ error: 'Ongeldig outputType.' }, { status: 400 });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const trimmed = transcript.trim();
    const { anonymized, map } = anonymize(trimmed);

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: PROMPTS[outputType](anonymized, recipient),
        },
      ],
    });

    const rawOutput = message.content[0].text;
    const finalOutput = deanonymize(rawOutput, map);

    // Save to database only if projectId is provided
    if (projectId && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL !== 'your_supabase_url') {
      try {
        const { createClient } = await import('@/lib/supabase-server');
        const supabase = await createClient();
        await supabase.from('outputs').insert({
          project_id: projectId,
          output_type: outputType,
          input_transcript: trimmed,
          result: finalOutput,
        });
      } catch (dbError) {
        console.error('Database save error (non-fatal):', dbError);
      }
    }

    return Response.json({ result: finalOutput });
  } catch (error) {
    console.error('Anthropic API error:', error);
    return Response.json(
      { error: 'Er is een fout opgetreden bij het verwerken van je verzoek.' },
      { status: 500 }
    );
  }
}
```

De enige wijziging ten opzichte van de vorige versie: `recipient` wordt uitgelezen uit de request body en doorgegeven aan `PROMPTS[outputType](anonymized, recipient)`. Bestaande prompts negeren het tweede argument — dit is volledig backward compatible.

- [ ] **Step 4: Verifieer build**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa && npm run build 2>&1 | grep -E "(error|Error|compiled|failed)" | head -10
```

Verwacht: geen errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa
git add lib/prompts.js app/api/chat/route.js
git commit -m "feat: add AllDay prompts (samenvatting/briefing/debrief) + recipient param in chat API"
```

---

## Task 5: TenantBadge component

**Files:**
- Maak aan: `components/TenantBadge.jsx`

Server component (geen `'use client'`). Rendert een branded header bar als de tenant een `logo_url` heeft. Voor `waybetter.nl` (geen logo) rendert niets.

- [ ] **Step 1: Maak `components/TenantBadge.jsx` aan**

```jsx
export default function TenantBadge({ tenant }) {
  if (!tenant?.logo_url) return null;

  return (
    <div className="w-full bg-[#0d0d0d] border-b border-white/[0.06]" style={{ height: '52px' }}>
      <div className="max-w-[900px] mx-auto px-8 h-full flex items-center justify-between">
        <img
          src={tenant.logo_url}
          alt={tenant.name}
          style={{ height: '20px', width: 'auto' }}
        />
        <span className="text-[10px] tracking-[0.1em] uppercase text-white/40 font-[family-name:var(--font-outfit)]">
          Powered by Waybetter
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa
git add components/TenantBadge.jsx
git commit -m "feat: add TenantBadge — server component, renders branded header from tenant config"
```

---

## Task 6: AllDayTranscriptForm component

**Files:**
- Maak aan: `components/AllDayTranscriptForm.jsx`

Client component met:
- 3 outputtype-knoppen (Samenvatting / Briefing / Debrief)
- 4 ontvanger-pills (Team / Klant / Leverancier / Directie)
- Zelfde file upload + recording logica als PublicTranscriptForm (code gedupliceerd voor onafhankelijkheid)
- Fetch naar `/api/chat` met `recipient` in de body

- [ ] **Step 1: Maak `components/AllDayTranscriptForm.jsx` aan**

```jsx
'use client';

import { useState, useRef } from 'react';
import OutputCard from '@/components/OutputCard';
import { isAudioFile, useAudioTranscription } from '@/lib/use-audio';

const ALLDAY_TYPES = [
  { key: 'allday-samenvatting', label: 'Samenvatting', desc: 'De kern van het gesprek in een oogopslag' },
  { key: 'allday-briefing', label: 'Briefing', desc: 'Klaar om mee aan de slag' },
  { key: 'allday-debrief', label: 'Debrief', desc: 'Terugkoppeling na afronding' },
];

const RECIPIENTS = [
  { key: 'team', label: 'Team' },
  { key: 'klant', label: 'Klant' },
  { key: 'leverancier', label: 'Leverancier' },
  { key: 'directie', label: 'Directie' },
];

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function AllDayTranscriptForm() {
  const [transcript, setTranscript] = useState('');
  const [selectedType, setSelectedType] = useState(null);
  const [selectedRecipient, setSelectedRecipient] = useState('team');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [fileStatus, setFileStatus] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [copyTranscriptLabel, setCopyTranscriptLabel] = useState('Kopieer transcript');
  const toolRef = useRef(null);

  const {
    transcribing,
    recording,
    paused,
    elapsed,
    lastRecordingUrl,
    transcribeFile,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    discardRecording,
  } = useAudioTranscription({
    onTranscript: (text) => setTranscript(text),
    onStatus: (msg) => msg ? setFileStatus({ msg, type: 'success' }) : setFileStatus(null),
    onError: (msg) => setFileStatus({ msg, type: 'error' }),
  });

  function handleReset() {
    setTranscript('');
    setSelectedType(null);
    setSelectedRecipient('team');
    setResult(null);
    setError(null);
    setFileStatus(null);
  }

  function selectAndScroll(key) {
    setSelectedType(key);
    setTimeout(() => {
      toolRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  async function handleGenerate() {
    if (!transcript.trim() || !selectedType) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, outputType: selectedType, recipient: selectedRecipient }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult({
          result: data.result,
          output_type: selectedType,
          created_at: new Date().toISOString(),
        });
      }
    } catch {
      setError('Er is een fout opgetreden. Probeer het opnieuw.');
    } finally {
      setLoading(false);
    }
  }

  function handleFile(file) {
    if (!file) return;
    if (isAudioFile(file)) {
      setFileStatus({ msg: 'Je opname wordt verwerkt...', type: 'loading' });
      transcribeFile(file);
      return;
    }
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    const supported = ['.txt', '.pdf', '.doc', '.docx'];
    if (!supported.includes(ext)) {
      setFileStatus({ msg: `"${ext}" wordt niet ondersteund.`, type: 'error' });
      return;
    }
    setFileStatus({ msg: 'Bestand wordt ingelezen...', type: 'loading' });
    if (ext === '.txt') readTxt(file);
    else if (ext === '.pdf') readPdf(file);
    else readDocx(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }

  function readTxt(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      setTranscript(ev.target.result);
      setFileStatus({ msg: `"${file.name}" ingeladen.`, type: 'success' });
    };
    reader.onerror = () => setFileStatus({ msg: 'Fout bij inlezen.', type: 'error' });
    reader.readAsText(file);
  }

  async function readPdf(file) {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item) => item.str).join(' ') + '\n';
      }
      setTranscript(text.trim());
      setFileStatus({ msg: `"${file.name}" ingeladen (${pdf.numPages} pagina's).`, type: 'success' });
    } catch (err) {
      console.error('PDF parse error:', err);
      setFileStatus({ msg: 'Fout bij het uitlezen van de PDF.', type: 'error' });
    }
  }

  async function readDocx(file) {
    try {
      const mammoth = await import('mammoth');
      const arrayBuffer = await file.arrayBuffer();
      const r = await mammoth.extractRawText({ arrayBuffer });
      setTranscript(r.value.trim());
      setFileStatus({ msg: `"${file.name}" ingeladen.`, type: 'success' });
    } catch {
      setFileStatus({ msg: 'Fout bij het uitlezen van het Word-bestand.', type: 'error' });
    }
  }

  return (
    <>
      {/* Privacy badge */}
      <div className="bg-dark border-t border-dark-border">
        <div className="max-w-[900px] mx-auto px-8 py-5">
          <div className="inline-flex items-center gap-2.5 text-[13px] text-white/40 font-[family-name:var(--font-outfit)]">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-orange/70 shrink-0">
              <rect x="2" y="7" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span>
              Klantgegevens worden geanonimiseerd voor verwerking.
              <span className="text-white/25 ml-1">Veilig voor vertrouwelijke bureauinformatie.</span>
            </span>
          </div>
        </div>
      </div>

      {/* Output type selector */}
      <section className="bg-dark border-t border-dark-border">
        <div className="max-w-[900px] mx-auto px-8 py-14">
          <p className="text-[13px] text-white/30 font-[family-name:var(--font-outfit)] mb-5">
            Wat wil je vandaag maken?
          </p>
          <div className="grid grid-cols-3 gap-4 max-[580px]:grid-cols-1">
            {ALLDAY_TYPES.map(({ key, label, desc }) => (
              <button
                key={key}
                onClick={() => selectAndScroll(key)}
                className={`group text-left rounded-xl p-6 transition-all duration-200 cursor-pointer border ${
                  selectedType === key
                    ? 'bg-orange/10 border-orange/40 shadow-[0_0_24px_rgba(255,72,0,0.1)]'
                    : 'bg-dark-card border-dark-border hover:border-orange/30 hover:bg-orange/[0.04]'
                }`}
              >
                <span className={`block text-[17px] font-semibold mb-2 transition-colors font-[family-name:var(--font-outfit)] ${
                  selectedType === key ? 'text-orange' : 'text-white/85 group-hover:text-white'
                }`}>
                  {label}
                </span>
                <span className="block text-[13px] text-white/30 leading-snug font-[family-name:var(--font-outfit)]">
                  {desc}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Tool */}
      <section ref={toolRef} className="bg-warm scroll-mt-4 border-t border-dark-border" id="tool">
        <div className="max-w-[900px] mx-auto px-8 py-16">
          <div className="border border-border rounded-2xl p-8 max-[480px]:p-5 bg-white shadow-sm">
            <h2 className="font-[family-name:var(--font-lexend)] text-lg font-semibold text-text mb-1">
              Jouw input
            </h2>
            <p className="text-[15px] text-text-sec mb-5 font-[family-name:var(--font-outfit)]">
              Plak tekst, typ je aantekeningen of sleep een bestand.
            </p>

            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
              onDrop={handleDrop}
              placeholder="Plak je aantekeningen, typ wat je hebt opgeschreven, of sleep een bestand hierin."
              spellCheck={false}
              className={`w-full min-h-[200px] border-[1.5px] rounded-xl px-5 py-4 text-sm text-text leading-[1.75] resize-y outline-none transition-all font-[family-name:var(--font-outfit)] ${
                dragOver
                  ? 'border-orange border-dashed bg-orange-light shadow-[0_0_0_3px_rgba(255,72,0,0.1)]'
                  : 'border-border bg-warm focus:border-orange focus:shadow-[0_0_0_3px_rgba(255,72,0,0.08)]'
              }`}
            />

            {/* Recording UI */}
            {recording ? (
              <div className="mt-4 border border-red-200 bg-red-50/60 rounded-xl px-5 py-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                  </span>
                  <span className="text-[14px] font-semibold text-red-600 font-[family-name:var(--font-outfit)]">
                    {paused ? 'Opname gepauzeerd' : 'Opname bezig...'}
                  </span>
                  <span className="text-[15px] font-mono font-semibold text-red-500 tabular-nums">
                    {formatTime(elapsed)}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={paused ? resumeRecording : pauseRecording}
                    className="h-9 px-4 border border-red-200 rounded-lg text-[13px] font-medium text-red-600 bg-white transition-all hover:bg-red-50 hover:border-red-300 active:scale-[0.98] cursor-pointer font-[family-name:var(--font-outfit)]"
                  >
                    {paused ? 'Hervatten' : 'Pauzeren'}
                  </button>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="h-9 px-4 bg-red-500 text-white rounded-lg text-[13px] font-semibold transition-all hover:bg-red-600 active:scale-[0.98] cursor-pointer font-[family-name:var(--font-outfit)]"
                  >
                    Stoppen
                  </button>
                  <button
                    type="button"
                    onClick={discardRecording}
                    className="h-9 px-4 border border-border rounded-lg text-[13px] font-medium text-text-muted transition-all hover:border-red-200 hover:text-red-500 active:scale-[0.98] cursor-pointer font-[family-name:var(--font-outfit)]"
                  >
                    Verwijderen
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <label className="inline-flex items-center gap-2 text-[13px] text-text-sec hover:text-orange transition-colors cursor-pointer font-[family-name:var(--font-outfit)]">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 10v2.667A1.334 1.334 0 0 1 12.667 14H3.333A1.334 1.334 0 0 1 2 12.667V10" />
                      <polyline points="5,6 8,3 11,6" />
                      <line x1="8" y1="3" x2="8" y2="10" />
                    </svg>
                    Upload bestand
                    <input
                      type="file"
                      accept=".txt,.pdf,.doc,.docx,.mp3,.m4a,.mp4,.wav,.ogg,.webm"
                      className="hidden"
                      onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ''; }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={transcribing}
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-sec hover:text-orange transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-[family-name:var(--font-outfit)]"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <rect x="5" y="1" width="6" height="10" rx="3" />
                      <path d="M13 7a5 5 0 0 1-10 0" />
                      <line x1="8" y1="12" x2="8" y2="15" />
                      <line x1="5.5" y1="15" x2="10.5" y2="15" />
                    </svg>
                    Opnemen
                  </button>

                  {transcript.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(transcript).then(() => {
                          setCopyTranscriptLabel('Gekopieerd \u2713');
                          setTimeout(() => setCopyTranscriptLabel('Kopieer transcript'), 2200);
                        });
                      }}
                      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-sec hover:text-orange transition-all cursor-pointer font-[family-name:var(--font-outfit)]"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <rect x="6" y="6" width="8" height="8" rx="1.5" />
                        <path d="M10 6V3.5A1.5 1.5 0 0 0 8.5 2h-5A1.5 1.5 0 0 0 2 3.5v5A1.5 1.5 0 0 0 3.5 10H6" />
                      </svg>
                      {copyTranscriptLabel}
                    </button>
                  )}

                  {fileStatus && (
                    <span className={`text-xs font-[family-name:var(--font-outfit)] ${
                      fileStatus.type === 'error' ? 'text-red-500' :
                      fileStatus.type === 'success' ? 'text-emerald-600' : 'text-text-muted'
                    }`}>
                      {fileStatus.msg}
                      {fileStatus.type === 'success' && lastRecordingUrl && (
                        <a
                          href={lastRecordingUrl}
                          download="opname.webm"
                          className="inline-flex items-center gap-1 ml-2 text-orange hover:text-orange-hover transition-colors"
                        >
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 10v2.667A1.334 1.334 0 0 1 12.667 14H3.333A1.334 1.334 0 0 1 2 12.667V10" />
                            <polyline points="5,10 8,13 11,10" />
                            <line x1="8" y1="13" x2="8" y2="3" />
                          </svg>
                          Download audio
                        </a>
                      )}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-text-muted mt-2 font-[family-name:var(--font-outfit)]">
                  Upload tekst, Word, PDF of een audiobestand.
                </p>
              </>
            )}

            <div className="h-px bg-border my-7" />

            <h2 className="font-[family-name:var(--font-lexend)] text-lg font-semibold text-text mb-1">
              Wat wil je maken?
            </h2>
            <p className="text-[15px] text-text-sec mb-4 font-[family-name:var(--font-outfit)]">
              Kies een type en een ontvanger.
            </p>

            {/* Output type selector in form */}
            <div className="grid grid-cols-3 gap-2 max-[480px]:grid-cols-1">
              {ALLDAY_TYPES.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSelectedType(key)}
                  className={`text-left border-[1.5px] rounded-lg p-3 text-[14px] font-semibold leading-[1.4] transition-all active:scale-[0.98] cursor-pointer font-[family-name:var(--font-outfit)] ${
                    selectedType === key
                      ? 'border-orange text-orange bg-orange-light shadow-[0_0_0_1px_#FF4800]'
                      : 'border-border text-text-sec hover:border-orange hover:text-orange hover:bg-orange-light'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Recipient selector */}
            <div className="mt-5">
              <span className="text-[12px] text-text-muted font-[family-name:var(--font-outfit)] block mb-2">
                Voor wie?
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {RECIPIENTS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedRecipient(key)}
                    className={`h-8 px-4 rounded-lg text-[13px] font-medium transition-all active:scale-[0.98] cursor-pointer font-[family-name:var(--font-outfit)] ${
                      selectedRecipient === key
                        ? 'bg-orange text-white shadow-[0_2px_8px_rgba(255,72,0,0.25)]'
                        : 'border-[1.5px] border-border text-text-sec hover:border-orange hover:text-orange'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {selectedType && (
              <div className="mt-7 flex items-center gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={loading || !transcript.trim()}
                  className="h-12 px-8 bg-orange text-white rounded-lg text-sm font-semibold transition-all hover:bg-orange-hover shadow-orange hover:shadow-[0_6px_24px_rgba(255,72,0,0.3)] active:scale-[0.98] disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer font-[family-name:var(--font-outfit)]"
                >
                  {loading ? 'Bezig met verwerken...' : 'Verwerk \u2192'}
                </button>
                <button
                  onClick={handleReset}
                  className="h-12 px-5 border-[1.5px] border-border text-text-sec rounded-lg text-sm font-medium transition-all hover:border-text-muted hover:text-text active:scale-[0.98] cursor-pointer font-[family-name:var(--font-outfit)]"
                >
                  Nieuw bestand
                </button>
              </div>
            )}

            {error && (
              <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-5 py-4 font-[family-name:var(--font-outfit)]">
                {error}
              </div>
            )}
          </div>
        </div>
      </section>

      {result && (
        <section className="bg-warm pb-16">
          <div className="max-w-[900px] mx-auto px-8">
            <OutputCard output={result} transcript={transcript} />
          </div>
        </section>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verifieer build**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa && npm run build 2>&1 | grep -E "(error|Error|compiled|failed)" | head -10
```

Verwacht: geen errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa
git add components/AllDayTranscriptForm.jsx
git commit -m "feat: add AllDayTranscriptForm — 3 output types + recipient selector"
```

---

## Task 7: Update page.js — tenant-aware rendering

**Files:**
- Wijzig: `app/page.js`

Maak `Home()` een async function die tenant ophaalt via `getTenant()`. Kies op basis van hostname: `AllDayTranscriptForm` voor `allday.waybetter.nl`, anders `PublicTranscriptForm`. Vervang `ChaseBadge` door `TenantBadge`.

- [ ] **Step 1: Vervang `app/page.js` volledig**

```javascript
export const dynamic = 'force-dynamic';

import nextDynamic from 'next/dynamic';
import Footer from '@/components/Footer';
import AuthNav from '@/components/AuthNav';
import TenantBadge from '@/components/TenantBadge';
import { getTenant } from '@/lib/get-tenant';

const PublicTranscriptForm = nextDynamic(
  () => import('@/components/PublicTranscriptForm'),
  { loading: () => <div className="bg-dark min-h-[400px]" /> }
);

const AllDayTranscriptForm = nextDynamic(
  () => import('@/components/AllDayTranscriptForm'),
  { loading: () => <div className="bg-dark min-h-[400px]" /> }
);

export default async function Home() {
  const tenant = await getTenant();
  const isAllDay = tenant?.hostname === 'allday.waybetter.nl';

  return (
    <>
      <TenantBadge tenant={tenant} />

      {/* Hero */}
      <section className="relative bg-dark overflow-hidden">
        <AuthNav />

        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-[-20%] left-[10%] w-[500px] h-[500px] rounded-full bg-orange/[0.05] blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[15%] w-[400px] h-[400px] rounded-full bg-orange/[0.03] blur-[100px]" />
        </div>

        <div className="relative max-w-[900px] mx-auto px-8 pt-[100px] pb-16 max-[640px]:pt-[72px] max-[640px]:pb-12">
          {!isAllDay && (
            <div className="animate-hero-1">
              <div className="inline-flex items-center gap-2.5 mb-8">
                <span className="font-[family-name:var(--font-lexend)] text-[11px] tracking-[0.2em] font-semibold text-orange uppercase">Waybetter</span>
                <span className="text-orange text-[14px]">&middot;</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange font-[family-name:var(--font-outfit)]">Made for agency people</span>
              </div>
            </div>
          )}

          <h1 className="animate-hero-2 font-[family-name:var(--font-lexend)] text-[clamp(36px,6.5vw,68px)] font-extrabold leading-[1.06] tracking-[-0.025em] text-white mb-7">
            Van aantekening{'\u00A0'}
            <br className="max-[640px]:hidden" />
            naar briefing.
            <br />
            <span className="text-orange">In seconden.</span>
          </h1>

          <p className="animate-hero-3 text-[17px] text-white/50 leading-[1.65] max-w-[540px] font-[family-name:var(--font-outfit)]">
            {isAllDay
              ? 'Zet gesprekken, aantekeningen en opnamen direct om naar briefings, samenvattingen en debriefs. Op maat voor jouw team of klant.'
              : 'Waybetter verwerkt je aantekeningen, opgenomen gesprekken en bestanden naar direct bruikbare documenten voor je team of klant. In jouw format, in jouw toon.'}
          </p>
        </div>
      </section>

      {isAllDay ? <AllDayTranscriptForm /> : <PublicTranscriptForm />}

      <Footer />
    </>
  );
}
```

- [ ] **Step 2: Verifieer build**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa && npm run build 2>&1 | grep -E "(error|Error|compiled|failed)" | head -10
```

Verwacht: geen errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa
git add app/page.js
git commit -m "feat: page.js — async tenant-aware rendering, TenantBadge, AllDay/default form switch"
```

---

## Task 8: Verwijder ChaseBadge

**Files:**
- Verwijder: `components/ChaseBadge.jsx`

`ChaseBadge` is volledig vervangen door `TenantBadge`. Na Task 7 wordt `ChaseBadge` nergens meer geimporteerd.

- [ ] **Step 1: Verifieer dat ChaseBadge niet meer geimporteerd wordt**

```bash
grep -r "ChaseBadge" /Users/caesardriessen/Desktop/Github/oyaa --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" | grep -v "node_modules" | grep -v ".next"
```

Verwacht: geen output (nul matches).

- [ ] **Step 2: Verwijder het bestand**

```bash
rm /Users/caesardriessen/Desktop/Github/oyaa/components/ChaseBadge.jsx
```

- [ ] **Step 3: Verifieer build na verwijdering**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa && npm run build 2>&1 | grep -E "(error|Error|compiled|failed)" | head -10
```

Verwacht: geen errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa
git add -A
git commit -m "chore: remove ChaseBadge — replaced by TenantBadge"
```

---

## Task 9: Smoke test alle drie subdomeinen

Geen geautomatiseerde tests beschikbaar. Handmatige verificatie via `npm run dev`.

- [ ] **Step 1: Start dev server**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa && npm run dev
```

Open `http://localhost:3000` in Chrome.

- [ ] **Step 2: Test waybetter.nl (default)**

Op `http://localhost:3000`:
- Geen branded header bar
- Hero toont "Waybetter · Made for agency people"
- 9 outputtype-knoppen zichtbaar
- Transcript invoeren + type kiezen + "Verwerk" werkt

- [ ] **Step 3: Test chase.waybetter.nl (branded badge)**

Voeg `chase.waybetter.nl` toe aan `/etc/hosts`:

```bash
echo "127.0.0.1 chase.waybetter.nl" | sudo tee -a /etc/hosts
```

Open `http://chase.waybetter.nl:3000` in Chrome.

Verwacht:
- Zwarte balk bovenaan met Chase Amsterdam logo en "Powered by Waybetter"
- Hero en 9-knoppen-UI identiek aan waybetter.nl
- Transcript + generate werkt normaal

- [ ] **Step 4: Test allday.waybetter.nl (nieuwe UI)**

```bash
echo "127.0.0.1 allday.waybetter.nl" | sudo tee -a /etc/hosts
```

Open `http://allday.waybetter.nl:3000` in Chrome.

Verwacht:
- TenantBadge: als `logo_url` ingevuld is, verschijnt het logo. Anders: geen badge (ok voor nu)
- Hero toont AllDay-specifieke subtitel, geen "Waybetter · Made for agency people"
- 3 grote knoppen: Samenvatting / Briefing / Debrief
- Ontvanger-pills: Team / Klant / Leverancier / Directie
- Transcript invoeren + type + ontvanger kiezen + "Verwerk" werkt
- Output verschijnt in OutputCard

- [ ] **Step 5: Test live recording (fast path ongewijzigd)**

Op elk van de drie domeinen: klik microfoon → neem 30 seconden op → stop → transcript verschijnt.

Verwacht: werkt zoals voorheen, geen chunk-logica (live recording = directe POST).

- [ ] **Step 6: Verwijder test-entries uit /etc/hosts**

```bash
sudo sed -i '' '/chase.waybetter.nl/d' /etc/hosts
sudo sed -i '' '/allday.waybetter.nl/d' /etc/hosts
```

---

## Task 10: Deploy

- [ ] **Step 1: Controleer alle commits**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa && git log --oneline -10
```

Verwacht: zie commits voor migration, middleware, get-tenant, prompts, chat API, TenantBadge, AllDayTranscriptForm, page.js, en ChaseBadge removal.

- [ ] **Step 2: Push naar GitHub**

```bash
cd /Users/caesardriessen/Desktop/Github/oyaa && git push origin main
```

Vercel start automatisch een deploy.

- [ ] **Step 3: Verifieer Vercel build**

Check Vercel dashboard → wacht op "Ready". Als de build faalt, lees de Vercel build logs.

- [ ] **Step 4: Smoke test op productie**

Test op `waybetter.nl`:
- Geen branded header, 9 knoppen, generate werkt

Test op `chase.waybetter.nl`:
- Chase branded header, 9 knoppen, generate werkt

Test op `allday.waybetter.nl`:
- (Geen header als logo nog null is), AllDay UI, generate met recipient werkt

- [ ] **Step 5: Voeg AllDay logo URL in via Supabase dashboard**

Zoek de correcte logo URL op `wedothisallday.com` en voer in Supabase SQL Editor:

```sql
update public.tenants
set logo_url = 'ECHTE_URL_HIER'
where hostname = 'allday.waybetter.nl';
```

Herlaad `allday.waybetter.nl` — TenantBadge verschijnt nu met het All Day logo.

---

## Spec Coverage Check

| Vereiste | Task |
|----------|------|
| `tenants` tabel met id/hostname/name/logo_url/primary_color/enabled_output_types/tenant_config/created_at | Task 1 |
| Seed waybetter.nl (alle 9 types, geen logo) | Task 1 |
| Seed chase.waybetter.nl (Chase logo, alle 9 types) | Task 1 |
| Seed allday.waybetter.nl (3 allday types, recipients config) | Task 1 |
| Next.js middleware, hostname-detectie | Task 2 |
| Fallback naar waybetter.nl als hostname niet matcht | Task 3 |
| Tenant beschikbaar voor server components | Tasks 3, 7 |
| Vervang ChaseBadge door tenant-aware branding component | Tasks 5, 8 |
| Logo, kleur, naam uit tenant-config | Task 5 |
| AllDay: 3 hoofdtypen (Samenvatting/Briefing/Debrief) | Tasks 4, 6 |
| AllDay: "Voor wie?" dropdown met 4 opties | Task 6 |
| System prompt combineert hoofdtype + ontvanger | Task 4 |
| Chase en waybetter.nl behouden 9-knoppen UI | Task 7 (geen wijziging aan PublicTranscriptForm) |
| `enabled_output_types` per tenant in database | Task 1 |
| Audio-upload chunking blijft werken | Niet aangeraakt |
| Niets kapot aan waybetter.nl of chase.waybetter.nl | Tasks 8, 9 |
