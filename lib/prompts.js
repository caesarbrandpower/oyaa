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
};

export const PROMPTS = {
  'summary-actions': (transcript) =>
    `Je bent een scherpe collega bij een bureau. Schrijf een samenvatting van dit gesprek alsof je het doorgeeft aan een teamgenoot: menselijk, direct, in actieve zinnen. Geen ambtelijke of passieve constructies.

Regels:
- Gebruik namen zoals ze in het gesprek vallen. Is een naam onduidelijk, gebruik dan een functieaanduiding ("de accountmanager", "de directeur"). Nooit initialen.
- Bij langere gesprekken met meerdere onderwerpen: gebruik thematische kopjes per onderwerp. Volg de structuur van het gesprek, niet een vast sjabloon.
- Neem alle onderwerpen mee die inhoudelijk relevant zijn, ook als ze zijdelings besproken worden.
- Sluit af met actiepunten voor alle betrokkenen, niet alleen de gebruiker. Gewone bullet points in heldere taal. Geen eigenaar/deadline-tabel tenzij expliciet gevraagd.

Transcript:
${transcript}

Schrijf in helder, direct Nederlands.`,

  'summary-actions-internal': (transcript) =>
    `Je bent een scherpe collega bij een bureau. Schrijf een interne samenvatting van dit gesprek: menselijk, direct, in actieve zinnen. Dit is voor intern gebruik, dus namen, details en eigenaren mogen erin.

Regels:
- Gebruik namen zoals ze in het gesprek vallen. Is een naam onduidelijk, gebruik dan een functieaanduiding ("de accountmanager", "de directeur"). Nooit initialen.
- Bij langere gesprekken met meerdere onderwerpen: gebruik thematische kopjes per onderwerp. Volg de structuur van het gesprek, niet een vast sjabloon.
- Neem alle onderwerpen mee die inhoudelijk relevant zijn, ook als ze zijdelings besproken worden.
- Sluit af met actiepunten voor alle betrokkenen. Bij intern mag je eigenaren en deadlines noemen als ze in het gesprek vallen. Gewone bullet points in heldere taal.

Transcript:
${transcript}

Schrijf in helder, direct Nederlands.`,

  'summary-actions-external': (transcript) =>
    `Je bent een scherpe collega bij een bureau. Schrijf een samenvatting van dit gesprek die je kunt doorsturen naar iemand buiten het bureau (klant, partner, leverancier). Menselijk en direct, maar zonder interne namen, jargon of details die alleen intern relevant zijn.

Regels:
- Gebruik geen interne namen of functies. Verwijs naar "het team", "ons bureau" of "wij".
- Bij langere gesprekken met meerdere onderwerpen: gebruik thematische kopjes per onderwerp. Volg de structuur van het gesprek, niet een vast sjabloon.
- Neem alle onderwerpen mee die inhoudelijk relevant zijn, ook als ze zijdelings besproken worden.
- Sluit af met actiepunten voor alle betrokkenen. Formuleer ze zodat ze voor een buitenstaander helder zijn. Gewone bullet points, geen eigenaar/deadline-tabel.

Transcript:
${transcript}

Schrijf in helder, professioneel Nederlands. Leesbaar voor iemand buiten het bureau.`,

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

Schrijf in professioneel Nederlands.`,

  'supplier-briefing': (transcript) =>
    `Je bent een ervaren accountmanager bij een bureau dat werkt met externe leveranciers voor events, activaties en producties. Maak op basis van het onderstaande transcript een heldere leveranciersbriefing.

Gebruik de volgende structuur:

**Opdrachtomschrijving** — Wat moet er gebeuren? Wat is het eindresultaat?
**Tijdlijn** — Wanneer moet het klaar zijn? Zijn er tussenstappen?
**Contactpersoon** — Wie is het aanspreekpunt bij het bureau?
**Specificaties** — Welke technische of praktische eisen zijn er besproken?
**Budget/afspraken** — Welke financiele afspraken zijn er gemaakt (indien besproken)?
**Bijzonderheden** — Overige relevante details of aandachtspunten

Als informatie voor een sectie niet in het transcript staat, schrijf dan: "Niet besproken."

Transcript:
${transcript}

Schrijf in helder, direct Nederlands. De toon is professioneel en concreet.`,

  'staff-planning': (transcript) =>
    `Je bent een ervaren projectmanager bij een bureau dat personeel inplant voor events, activaties en projecten. Maak op basis van het onderstaande transcript een overzichtelijke personeelsplanning.

Gebruik de volgende structuur:

**Project/event** — Naam en korte omschrijving
**Datum en locatie** — Wanneer en waar
**Benodigde rollen** — Per rol: functie, aantal personen, tijden (start-eind)
**Bijzonderheden per rol** — Specifieke eisen, kledingvoorschriften, certificaten
**Logistiek** — Parkeren, catering, materiaal, overige praktische zaken
**Contactpersoon op locatie** — Wie is het aanspreekpunt?

Presenteer de rollen bij voorkeur als een overzichtelijke tabel of genummerde lijst. Als informatie voor een sectie niet in het transcript staat, schrijf dan: "Niet besproken."

Transcript:
${transcript}

Schrijf in helder Nederlands. Focus op praktische bruikbaarheid.`,

  'client-status': (transcript) =>
    `Je bent een ervaren accountmanager bij een bureau. Schrijf op basis van het onderstaande transcript een korte, professionele statusupdate die naar de klant verstuurd kan worden.

Gebruik de volgende structuur:

**Voortgang** — Wat is er sinds de laatste keer gebeurd? Welke stappen zijn gezet?
**Huidige status** — Waar staan we nu? Ligt het project op schema?
**Volgende stappen** — Wat gaat er de komende periode gebeuren?
**Actiepunten voor de klant** — Wat heeft het bureau nog nodig van de klant? (indien van toepassing)

Houd de update kort en scanbaar. Maximaal 200 woorden. Als informatie voor een sectie niet in het transcript staat, schrijf dan: "Niet besproken."

Transcript:
${transcript}

Schrijf in professioneel, klantgericht Nederlands. De toon is positief, transparant en beknopt.`,
};
