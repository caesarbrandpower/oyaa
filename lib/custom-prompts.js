// lib/custom-prompts.js
// Prompts specifiek voor de Custom chat-interface.
// Los van prompts.js zodat de bestaande forms onaangetast blijven.

export const CUSTOM_PROMPTS = {
  'meeting-summary': (text) =>
    `Je bent een scherpe collega bij een bureau. Schrijf een samenvatting van deze meeting: direct, menselijk, in actieve zinnen.

Gebruik namen zoals ze vallen. Is een naam onduidelijk, gebruik dan een functieaanduiding.
Bij meerdere onderwerpen: gebruik thematische kopjes. Volg de structuur van de meeting.
Sluit af met concrete actiepunten voor alle betrokkenen.

Input:
${text}

Schrijf in helder, direct Nederlands.`,

  'project-briefing': (text) =>
    `Je bent een ervaren accountmanager bij een bureau. Maak op basis van deze input een heldere interne projectbriefing voor het team.

Gebruik deze structuur:
**Project in het kort** — Klant, contactpersoon, omschrijving, periode, budget
**Doelstelling en doelgroep** — Wat wil de klant bereiken, voor wie, beoogd effect
**Scope: wat doen we** — Concrete werkzaamheden per fase
**Scope: wat doen we niet** — Buiten scope of bij klant
**Deliverables** — Wat leveren we op en wanneer
**Planning** — Tijdlijn met fases
**Team** — Wie heeft welke rol
**Aandachtspunten** — Wat moet bewaakt worden

Als info ontbreekt schrijf: [AFSTEMMEN MET KLANT] of [UITZOEKEN INTERN] gevolgd door de concrete vraag.
Geen liggende streepjes in de output. Schrijf in helder Nederlands.

Input:
${text}`,

  'account-pm-briefing': (text) =>
    `Je bent een accountmanager bij een bureau. Schrijf een heldere overdracht van account naar de projectmanager op basis van deze input.

De PM moet hiermee zelfstandig verder kunnen. Geef:
**Context** — Wat speelt er, wat is de achtergrond
**Opdracht** — Wat moet er concreet gedaan worden
**Klant** — Contactpersoon, verwachtingen, gevoeligheden
**Planning en deadlines** — Wat is er al beloofd, wat moet wanneer klaar
**Open punten** — Wat moet de PM zelf uitzoeken of beslissen
**Eerste stap** — Wat doet de PM als eerste

Schrijf direct en concreet. Geen opsommingen zonder context.
Als info ontbreekt schrijf: [UITZOEKEN INTERN] gevolgd door de vraag.

Input:
${text}`,

  'evaluation': (text) =>
    `Je bent een ervaren projectmanager bij een bureau. Schrijf een professionele evaluatie op basis van deze input.

Gebruik deze structuur:
**Project in het kort** — Naam, klant, periode, korte omschrijving
**Wat is er gedaan** — Concrete werkzaamheden en deliverables
**Resultaten** — Wat heeft het opgeleverd. Gebruik harde cijfers waar beschikbaar.
**Wat ging goed** — Successen die herhaalbaar zijn. Eerlijk en concreet.
**Wat ging anders dan gepland** — Eerlijk en feitelijk. Geen defensieve toon.
**Wat nemen we hieruit mee** — Lessen voor volgende projecten. Concreet en bruikbaar.
**Aanbevelingen** — Concrete suggesties voor vervolg.

Als info ontbreekt schrijf: [CIJFERS TOEVOEGEN] of [NOG NIET CONCREET GENOEG] gevolgd door wat aangevuld moet worden.
Schrijf in professioneel Nederlands.

Input:
${text}`,

  'location-search': () =>
    `Deze functie wordt binnenkort gekoppeld aan de locatiedatabase. Momenteel is de locatiezoekopdracht nog niet actief.

Heb je een specifieke locatievraag? Stel hem dan als vrije vraag in de chat.`,

  'supplier-search': () =>
    `Deze functie wordt binnenkort gekoppeld aan de leverancierslijst. Momenteel is de leverancierszoekopdracht nog niet actief.

Heb je een specifieke leveranciersvraag? Stel hem dan als vrije vraag in de chat.`,
};

export const CUSTOM_SYSTEM_PROMPT = `Je bent een AI-assistent voor een creatief bureau. Je helpt met het verwerken van notities, gesprekken en aantekeningen naar bruikbare documenten. Schrijf in helder Nederlands. Wees concreet en bondig. Geen liggende streepjes in je output.`;

// Welke output types produceren een document (vs. search/informatie)
export const DOCUMENT_OUTPUT_TYPES = new Set([
  'meeting-summary',
  'project-briefing',
  'account-pm-briefing',
  'evaluation',
]);

// Label en icoon per output type — gebruikt in docs-archief
export const OUTPUT_TYPE_INFO = {
  'meeting-summary':      { label: 'Notulen',         icon: 'clipboard-list' },
  'project-briefing':     { label: 'Projectbriefing', icon: 'file-text' },
  'account-pm-briefing':  { label: 'PM Overdracht',   icon: 'pen-line' },
  'evaluation':           { label: 'Evaluatie',        icon: 'bar-chart-2' },
};
