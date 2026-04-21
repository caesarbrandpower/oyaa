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

  // AllDay types — accepteren een optionele recipient parameter
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
};
