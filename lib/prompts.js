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

  // AllDay types
  'allday-samenvatting': (transcript) =>
    `Je bent een ervaren notulist. Schrijf een neutrale, feitelijke samenvatting van dit gesprek. Alleen wat er gezegd is. Geen interpretatie, geen aanpassing op een specifiek publiek.

Gebruik precies deze structuur en koppen:

# SAMENVATTING — [vul het onderwerp in op basis van het gesprek]

## Onderwerp / aanleiding
[Waar ging het gesprek over, wat was de aanleiding]

## Aanwezigen
[Wie waren aanwezig, zoals vermeld in het transcript. Als onbekend: schrijf "Niet vermeld."]

## Belangrijkste punten
[Wat is besproken, in volgorde van belang. Maximaal 12 bullets. Schrijf actief: "De klant wil..." niet "Er werd besproken dat..."]

## Besluiten
[Wat is er besloten. Als niets besloten: schrijf "Geen besluiten genomen."]

## Actiepunten
[Wie doet wat, wanneer. Formaat per punt:
- Wie: [naam of functie]
  Wat: [concrete actie]
  Wanneer: [datum of termijn, of "Niet besproken"]
Als geen actiepunten: schrijf "Geen actiepunten besproken."]

## Open vragen
[Wat is er niet beantwoord of nog onduidelijk. Als geen: schrijf "Geen open vragen."]

Regels:
- Schrijf in actieve, directe zinnen. Geen ambtelijke constructies.
- Geen liggende streepjes in de output. Gebruik komma's of nieuwe zinnen.
- Verzin niets. Alleen wat in het transcript staat.
- Schrijf in helder Nederlands.

Transcript:
${transcript}`,

  'allday-briefing': (transcript, recipient = 'team') => {
    const isLeverancier = recipient === 'leverancier';

    if (isLeverancier) {
      return `Je bent een ervaren projectmanager bij een bureau. Schrijf een heldere briefing voor een externe leverancier of freelancer op basis van dit transcript. Schrijf instructief en helder: dit is wat wij van jullie verwachten.

Gebruik precies deze structuur en koppen:

# PROJECTBRIEFING — [Projectnaam]

## 1. Project in het kort
- Opdrachtgever: [naam bureau of klant waarvoor gewerkt wordt]
- Contactpersoon: [naam en rol van het interne aanspreekpunt voor de leverancier]
- Korte projectomschrijving: [3-5 zinnen over wat het project inhoudt]
- Periode: [startdatum tot einddatum]
- Budget: [bedrag of "Wordt apart gecommuniceerd"]

## 2. Doelstelling en doelgroep
- Wat is het doel van het project: [concreet doel]
- Voor wie is dit project: [de eindgebruiker van het project, niet de opdrachtgever]
- Beoogd effect / ervaring: [wat moet de eindgebruiker voelen of ervaren]

## 3. Wat verwachten we van jullie
[Concrete werkzaamheden die de leverancier moet uitvoeren, opgesplitst per fase als relevant]

## 4. Wat valt buiten jullie scope
[Wat regelen wij of een andere partij]

## 5. Wat leveren jullie op (en wanneer)
[Concrete deliverables met data of fases]

## 6. Planning
[Tijdlijn met fases en data]

## 7. Locatie(s)
[Waar gebeurt wat, wat moet de leverancier weten over de locatie]

## 8. Aanspreekpunt
[Naam en rol van het interne aanspreekpunt]

## 9. Aandachtspunten
[Wat de leverancier moet weten voor een goede uitvoering, geen interne risico-inschattingen]

## 10. Bronnen
[Verwijzingen naar documenten als vermeld in de input]

---

# NOG TE DOEN VOOR EEN COMPLETE BRIEFING

## Afstemmen met opdrachtgever
[Per ontbrekend punt: concrete vraag]

## Uitzoeken voor deze briefing
[Per ontbrekend punt: concrete actie]

Regels voor ontbrekende informatie (gebruik deze exacte syntax):
- Als info bij de klant ligt: schrijf [AFSTEMMEN MET KLANT] gevolgd door de concrete vraag
- Als info intern bepaald moet worden: schrijf [UITZOEKEN INTERN] gevolgd door de concrete actie
- Als info deels besproken maar niet concreet genoeg: schrijf [NOG NIET CONCREET GENOEG] gevolgd door wat scherper moet
- Als een actiepunt geen uitvoerder heeft: schrijf [WIE GAAT DIT DOEN?]
- Als een actiepunt geen datum heeft: schrijf [WANNEER MOET DIT KLAAR ZIJN?]

Algemene regels:
- Geen liggende streepjes in de output. Gebruik komma's of nieuwe zinnen.
- Geen interne marges, geen klant-observaties, geen strategische opmerkingen.
- Verzin niets. Alleen wat in het transcript staat.
- Schrijf in helder Nederlands.

Transcript:
${transcript}`;
    }

    // Default: intern team
    return `Je bent een ervaren projectmanager bij een bureau. Schrijf een heldere interne briefing voor het team op basis van dit transcript.

Gebruik precies deze structuur en koppen:

# PROJECTBRIEFING — [Projectnaam]

## 1. Project in het kort
- Brand / Agency: [naam opdrachtgever]
- Main contact: [naam contactpersoon bij de klant]
- Korte projectomschrijving: [3-5 zinnen over wat het project inhoudt]
- Periode: [startdatum tot einddatum]
- Totaalbudget: [bedrag of bandbreedte]

## 2. Doelstelling en doelgroep
- Wat wil de klant bereiken: [concreet doel]
- Voor wie is dit project: [de eindgebruiker van het project, niet de directe opdrachtgever]
- Beoogd effect / ervaring: [wat moet de eindgebruiker voelen of ervaren]

## 3. Scope - wat doen we wel
[Concrete werkzaamheden, opgesplitst per fase als relevant]

## 4. Scope - wat doen we niet (of: nog te bepalen)
[Wat ligt bij de klant of andere partijen, wat valt buiten dit project]

## 5. Wat leveren we op (en wanneer)
[Concrete deliverables met data of fases]

## 6. Planning
[Tijdlijn met fases en data]

## 7. Locatie(s)
[Waar gebeurt wat]

## 8. Team
[Wie heeft welke rol intern]

## 9. Aandachtspunten en risico's
[Wat moet bewaakt worden, inclusief interne overwegingen en klant-observaties]

## 10. Bronnen
[Verwijzingen naar pitch-decks, mailwisselingen, andere documenten als vermeld in de input]

---

# NOG TE DOEN VOOR EEN COMPLETE BRIEFING

## Afstemmen met klant
[Per ontbrekend punt: concrete vraag of actie]

## Uitzoeken intern
[Per ontbrekend punt: concrete actie]

## Navragen bij leverancier
[Per ontbrekend punt: bij welke leverancier, welke vraag]

Regels voor ontbrekende informatie (gebruik deze exacte syntax):
- Als info alleen de klant kan geven: schrijf [AFSTEMMEN MET KLANT] gevolgd door de concrete vraag
- Als info intern bepaald moet worden: schrijf [UITZOEKEN INTERN] gevolgd door de concrete actie
- Als info bij een externe partij ligt: schrijf [NAVRAGEN BIJ NAAM] waar NAAM de naam van de leverancier is in hoofdletters, gevolgd door de vraag
- Als info deels besproken maar niet concreet genoeg: schrijf [NOG NIET CONCREET GENOEG] gevolgd door wat scherper moet
- Als een actiepunt geen uitvoerder heeft: schrijf [WIE GAAT DIT DOEN?]
- Als een actiepunt geen datum heeft: schrijf [WANNEER MOET DIT KLAAR ZIJN?]

Algemene regels:
- Schrijf in actieve, directe zinnen. Geen ambtelijke constructies.
- Geen liggende streepjes in de output. Gebruik komma's of nieuwe zinnen.
- Verzin niets. Alleen wat in het transcript staat.
- Schrijf in helder Nederlands.
- De doelgroep (sectie 2) is de eindgebruiker van het project, niet de opdrachtgever.

Transcript:
${transcript}`;
  },

  'allday-debrief': (transcript) =>
    `Je bent een ervaren accountmanager bij een bureau. Schrijf een professionele debrief naar de klant op basis van dit transcript. De toon is transparant, eerlijk en niet defensief.

Gebruik precies deze structuur en koppen:

# PROJECTDEBRIEF — [Projectnaam]

## 1. Project in het kort
- Brand / Agency: [naam opdrachtgever]
- Periode: [periode]
- Korte projectomschrijving: [2-3 zinnen]

## 2. Wat is er gedaan
[Concrete werkzaamheden en deliverables die zijn opgeleverd]

## 3. Resultaten
[Wat heeft het opgeleverd. Gebruik harde cijfers waar mogelijk.]

## 4. Wat ging goed
[Successen die herhaalbaar zijn. Eerlijk en concreet.]

## 5. Wat ging anders dan gepland
[Wat liep niet zoals verwacht. Eerlijk en feitelijk. Geen verdedigende toon.]

## 6. Wat nemen we hieruit mee
[Lessen voor volgende projecten. Concreet en bruikbaar.]

## 7. Vervolg of aanbevelingen
[Concrete suggesties voor vervolgstappen als relevant uit de input. Als niet besproken: schrijf "Niet besproken."]

---

# NOG TOE TE VOEGEN VOOR EEN COMPLETE DEBRIEF

## Cijfers en data
[Per ontbrekend cijfer: wat moet aangevuld worden]

## Achtergrond en context
[Per ontbrekende context: wat moet aangevuld worden]

## Onduidelijke punten
[Wat is nog te vaag, moet concreter]

Regels voor ontbrekende informatie (gebruik deze exacte syntax):
- Als resultaatcijfers ontbreken: schrijf [CIJFERS TOEVOEGEN] gevolgd door welke data aangevuld moeten worden
- Als achtergrond ontbreekt: schrijf [ACHTERGROND TOEVOEGEN] gevolgd door wat ontbreekt
- Als info deels besproken maar niet concreet genoeg: schrijf [NOG NIET CONCREET GENOEG] gevolgd door wat scherper moet

Algemene regels:
- Schrijf in actieve, directe zinnen. Geen ambtelijke constructies.
- Geen liggende streepjes in de output. Gebruik komma's of nieuwe zinnen.
- Geen interne marges, geen klant-observaties, geen strategische opmerkingen.
- Verzin niets. Alleen wat in het transcript staat.
- Schrijf in professioneel Nederlands.

Transcript:
${transcript}`,
};
