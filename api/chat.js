const Anthropic = require('@anthropic-ai/sdk');
const { anonymize, deanonymize } = require('../lib/anonymize');

const PROMPTS = {
  'summary-actions': (transcript) =>
    `Je bent een ervaren accountmanager bij een reclamebureau. Maak op basis van het onderstaande transcript een heldere samenvatting van het gesprek, gevolgd door alle actiepunten.

Gebruik deze structuur:

**Samenvatting** — wat is er besproken in 5-8 zinnen?

**Actiepunten** — genummerde lijst met per punt: de actie, de eigenaar (indien genoemd), en de deadline (indien genoemd). Als eigenaar of deadline niet vermeld is, schrijf dan "Niet besproken."

Transcript:
${transcript}

Schrijf in professioneel Nederlands.`,

  'internal-briefing': (transcript) =>
    `Je bent een ervaren accountmanager bij een reclamebureau. Maak op basis van het onderstaande transcript een heldere interne briefing voor het creatieve team.

Gebruik exact de volgende structuur en koppen:

**Achtergrond** — Wie is de klant, wat is de context, wat speelt er?
**Doel/doelstellingen** — Wat wil de klant bereiken? Wat is het meetbare resultaat?
**Strategie/inzichten** — Wat zijn relevante inzichten uit het gesprek? Wat zegt de klant tussen de regels door?
**Projectstatus** — Waar staan we nu? Wat is er al gedaan?
**Deadlines** — Welke concrete data zijn er genoemd?
**Concrete afspraken** — Wat is er exact afgesproken?
**Planning** — Wat zijn de volgende stappen en wanneer?
**Oplevering met specs** — Wat wordt er opgeleverd, in welk format, voor welk kanaal?

Als informatie voor een sectie niet in het transcript staat, schrijf dan: "Niet besproken."

Transcript:
${transcript}

Schrijf de briefing in professioneel Nederlands. Wees concreet en bondig.`,

  'external-debrief': (transcript) =>
    `Je bent een ervaren accountmanager bij een reclamebureau. Schrijf op basis van het onderstaande transcript een professionele externe debrief die naar de klant verstuurd kan worden na een meeting.

Gebruik de volgende structuur:
**Samenvatting van de bespreking**
**Genomen beslissingen**
**Afgesproken volgende stappen** (met eigenaar en datum indien besproken)
**Open punten** (zaken die nog bevestigd of uitgezocht moeten worden)

Als informatie voor een sectie niet in het transcript staat, schrijf dan: "Niet besproken."

Transcript:
${transcript}

Schrijf de debrief in formeel, klantgericht Nederlands. De toon is professioneel en bevestigend.`,

  'internal-actions': (transcript) =>
    `Je bent een ervaren accountmanager bij een reclamebureau. Extraheer uit het onderstaande transcript alle interne actiepunten voor het bureau.

Geef elk actiepunt weer als:
- **Actie:** beschrijving van de taak
- **Eigenaar:** wie is verantwoordelijk (indien vermeld)
- **Deadline:** wanneer moet het klaar zijn (indien vermeld)

Nummer de actiepunten. Als eigenaar of deadline niet in het transcript staat, schrijf dan: "Niet besproken."

Transcript:
${transcript}

Schrijf in helder Nederlands. Focus op interne taken voor het bureau.`,

  'external-actions': (transcript) =>
    `Je bent een ervaren accountmanager bij een reclamebureau. Extraheer uit het onderstaande transcript alle actiepunten voor de klant.

Geef elk actiepunt weer als:
- **Actie:** wat de klant moet doen
- **Deadline:** wanneer (indien vermeld)

Nummer de actiepunten. Als deadline niet in het transcript staat, schrijf dan: "Niet besproken."

Transcript:
${transcript}

Schrijf in professioneel Nederlands.`,

  'project-planning': (transcript) =>
    `Je bent een ervaren accountmanager bij een reclamebureau. Maak op basis van het onderstaande transcript een eerste aanzet voor een projectplanning.

Identificeer:
- **Projectnaam / omschrijving**
- **Fases** – geef elke fase een naam, beschrijving en indicatieve tijdlijn
- **Mijlpalen** – cruciale momenten of goedkeuringen
- **Deliverables per fase**
- **Betrokken partijen** – wie doet wat (bureau, klant, derden)
- **Kritische afhankelijkheden** – wat moet af zijn voordat iets anders kan starten

Baseer de tijdlijnen op wat in het transcript besproken is. Als informatie voor een onderdeel niet in het transcript staat, schrijf dan: "Niet besproken."

Transcript:
${transcript}

Schrijf in professioneel Nederlands.`
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { transcript, outputType } = req.body;

  if (!transcript || !transcript.trim()) {
    return res.status(400).json({ error: 'Transcript is verplicht.' });
  }

  if (!outputType || !PROMPTS[outputType]) {
    return res.status(400).json({ error: 'Ongeldig outputType.' });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const { anonymized, map } = anonymize(transcript.trim());

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: PROMPTS[outputType](anonymized)
        }
      ]
    });

    const rawOutput = message.content[0].text;
    const finalOutput = deanonymize(rawOutput, map);

    return res.status(200).json({ result: finalOutput });
  } catch (error) {
    console.error('Anthropic API error:', error);
    return res.status(500).json({ error: 'Er is een fout opgetreden bij het verwerken van je verzoek.' });
  }
};
