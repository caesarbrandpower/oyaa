import pptxgen from 'pptxgenjs';
import path from 'path';

const C = {
  navy:     '0F1052',
  yellow:   'E9FF31',
  greyblue: '9BAFBC',
  lightbg:  'EDECE9',
  white:    'FFFFFF',
  darkgrey: '444444',
};

const LOGO_MAIN = path.resolve(process.cwd(), 'public/chase_logo_main.png');
const LOGO_DIAP = path.resolve(process.cwd(), 'public/chase_logo_diap.png');

export async function buildPresentation(data) {
  const totaalSamples   = data.dagen.reduce((s, d) => s + d.samples, 0);
  const totaalBezoekers = data.dagen.reduce((s, d) => s + d.bezoekers, 0);
  const realisatiePct   = Math.round((totaalSamples / data.target) * 100);
  const delta           = totaalSamples - data.target;
  const TOTAL_SLIDES    = 8;

  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';
  pres.title  = `Evaluatie ${data.campagne}`;

  function addLogo(slide, variant = 'main', x = 8.53, y = 5.08) {
    slide.addImage({
      path: variant === 'diap' ? LOGO_DIAP : LOGO_MAIN,
      x, y, w: 1.8, h: 0.44,
      sizing: { type: 'contain', w: 1.8, h: 0.44 },
    });
  }

  function addPageNum(slide, num) {
    slide.addText(`${num} / ${TOTAL_SLIDES}`, {
      x: 0.18, y: 5.2, w: 1, h: 0.28,
      fontSize: 9, color: C.greyblue,
      fontFace: 'Tungsten Book', margin: 0,
    });
  }

  function slideTitle(slide, text) {
    slide.addText(text, {
      x: 0.5, y: 0.3, w: 9, h: 0.58,
      fontSize: 28, bold: true, color: C.navy,
      fontFace: 'Tungsten Bold', align: 'left', margin: 0,
    });
  }

  // SLIDE 1 — TITELSLIDE
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 0.5, h: 5.625,
      fill: { color: C.yellow }, line: { color: C.yellow, width: 0 },
    });
    s.addImage({ path: LOGO_DIAP, x: 0.7, y: 0.35, w: 1.5, h: 0.62,
      sizing: { type: 'contain', w: 1.5, h: 0.62 } });
    s.addText(data.campagne, {
      x: 0.7, y: 1.35, w: 4.6, h: 1.4,
      fontSize: 30, bold: true, color: C.white,
      fontFace: 'Tungsten Bold', align: 'left', margin: 0,
    });
    s.addText([
      { text: data.klant, options: { bold: true, color: C.yellow } },
      { text: `  ·  ${data.datum}`, options: { color: C.greyblue } },
    ], {
      x: 0.7, y: 2.88, w: 4.6, h: 0.45,
      fontSize: 14, fontFace: 'Tungsten Book', align: 'left', margin: 0,
    });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.7, y: 3.5, w: 2.2, h: 0.4,
      fill: { color: C.yellow }, line: { color: C.yellow, width: 0 }, rectRadius: 0.05,
    });
    s.addText('CAMPAGNE EVALUATIE', {
      x: 0.7, y: 3.5, w: 2.2, h: 0.4,
      fontSize: 9, bold: true, charSpacing: 1, color: C.navy,
      fontFace: 'Tungsten Bold', align: 'center', valign: 'middle', margin: 0,
    });
    addPageNum(s, 1);
  }

  // SLIDE 2 — KERNRESULTATEN
  {
    const s = pres.addSlide();
    s.background = { color: C.lightbg };
    slideTitle(s, 'KERNRESULTATEN');
    const cards = [
      { label: 'TARGET',       value: data.target.toLocaleString('nl-NL'),       sub: 'samples' },
      { label: 'GEREALISEERD', value: totaalSamples.toLocaleString('nl-NL'),      sub: 'samples', highlight: true },
      { label: 'REALISATIE',   value: `${realisatiePct}%`,                        sub: delta >= 0 ? `+${delta} boven target` : `${delta} onder target` },
      { label: 'BEZOEKERS',    value: totaalBezoekers.toLocaleString('nl-NL'),    sub: 'totaal bereik' },
    ];
    cards.forEach((card, i) => {
      const x = 0.4 + i * 2.32;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y: 1.05, w: 2.18, h: 2.7,
        fill: { color: card.highlight ? C.navy : C.white },
        line: { color: card.highlight ? C.navy : 'DDDDDD', width: 1 },
        rectRadius: 0.08,
        shadow: { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 90, opacity: 0.06 },
      });
      s.addText(card.label, {
        x: x + 0.12, y: 1.22, w: 1.94, h: 0.32,
        fontSize: 15, bold: false,
        color: card.highlight ? C.yellow : C.greyblue,
        fontFace: 'Tungsten Book', margin: 0,
      });
      s.addText(card.value, {
        x: x + 0.05, y: 1.6, w: 2.08, h: 1.1,
        fontSize: 38, bold: true,
        color: card.highlight ? C.white : C.navy,
        fontFace: 'Tungsten Bold', align: 'center', valign: 'middle', margin: 0,
      });
      s.addText(card.sub, {
        x: x + 0.05, y: 2.88, w: 2.08, h: 0.32,
        fontSize: 11, color: C.greyblue,
        fontFace: 'Tungsten Book', align: 'center', margin: 0,
      });
    });
    s.addText(`${data.dagen.length} dagen  ·  ${data.locaties.length} locaties  ·  ${data.periode}`, {
      x: 0.4, y: 4.0, w: 9, h: 0.35,
      fontSize: 12, color: C.darkgrey, fontFace: 'Tungsten Book', margin: 0,
    });
    addLogo(s);
    addPageNum(s, 2);
  }

  // SLIDE 3 — AANTALLEN PER DAG
  {
    const s = pres.addSlide();
    s.background = { color: C.white };
    slideTitle(s, 'AANTALLEN PER DAG');
    const dagLabels = data.dagen.map(d => d.dag);
    s.addChart(pres.charts.BAR, [
      { name: 'Bezoekers', labels: dagLabels, values: data.dagen.map(d => d.bezoekers) },
      { name: 'Samples',   labels: dagLabels, values: data.dagen.map(d => d.samples) },
    ], {
      x: 0.4, y: 1.0, w: 6.0, h: 4.0,
      barDir: 'col', barGrouping: 'clustered',
      chartColors: [C.greyblue, C.navy],
      chartArea: { fill: { color: C.white }, roundedCorners: false },
      catAxisLabelColor: '555555', valAxisLabelColor: '555555',
      valGridLine: { color: 'EEEEEE', size: 0.5 }, catGridLine: { style: 'none' },
      showLegend: true, legendPos: 'b', legendFontSize: 11,
      showValue: true, dataLabelFontSize: 9,
      dataLabelColor: C.white, dataLabelPosition: 'inEnd',
    });
    const tabelHeader = [
      { text: 'Dag',     options: { bold: true, fill: { color: C.navy }, color: C.white } },
      { text: 'Samples', options: { bold: true, fill: { color: C.navy }, color: C.white, align: 'center' } },
      { text: 'Bereik',  options: { bold: true, fill: { color: C.navy }, color: C.white, align: 'center' } },
    ];
    const tabelRows = [tabelHeader];
    data.dagen.forEach((d, i) => {
      const bg = i % 2 === 0 ? 'F5F5F5' : C.white;
      tabelRows.push([
        { text: d.dag,                               options: { fill: { color: bg } } },
        { text: d.samples.toLocaleString('nl-NL'),   options: { fill: { color: bg }, align: 'center' } },
        { text: d.bezoekers.toLocaleString('nl-NL'), options: { fill: { color: bg }, align: 'center' } },
      ]);
    });
    tabelRows.push([
      { text: 'Totaal',                                  options: { bold: true, fill: { color: C.lightbg } } },
      { text: totaalSamples.toLocaleString('nl-NL'),     options: { bold: true, fill: { color: C.lightbg }, align: 'center' } },
      { text: totaalBezoekers.toLocaleString('nl-NL'),   options: { bold: true, fill: { color: C.lightbg }, align: 'center' } },
    ]);
    s.addTable(tabelRows, {
      x: 6.7, y: 1.0, w: 3.1,
      colW: [1.45, 0.85, 0.8],
      border: { pt: 0.5, color: 'E0E0E0' },
      fontSize: 11, fontFace: 'Tungsten Book', rowH: 0.46,
    });
    addLogo(s);
    addPageNum(s, 3);
  }

  // SLIDE 4 — RESULTATEN PER LOCATIE
  {
    const s = pres.addSlide();
    s.background = { color: C.lightbg };
    slideTitle(s, 'RESULTATEN PER LOCATIE');
    const header = [
      { text: 'Locatie',    options: { bold: true, fill: { color: C.navy }, color: C.white, align: 'left' } },
      { text: 'Doel',       options: { bold: true, fill: { color: C.navy }, color: C.white, align: 'center' } },
      { text: 'Realisatie', options: { bold: true, fill: { color: C.navy }, color: C.white, align: 'center' } },
      { text: 'Contacten',  options: { bold: true, fill: { color: C.navy }, color: C.white, align: 'center' } },
      { text: '%',          options: { bold: true, fill: { color: C.navy }, color: C.white, align: 'center' } },
    ];
    const rows = [header];
    data.locaties.forEach((loc, i) => {
      const pct = Math.round((loc.gerealiseerd / loc.doel) * 100);
      const bg = i % 2 === 0 ? 'F0F0EE' : C.white;
      rows.push([
        { text: loc.naam,                                 options: { fill: { color: bg }, align: 'left' } },
        { text: loc.doel.toLocaleString('nl-NL'),         options: { fill: { color: bg }, align: 'center' } },
        { text: loc.gerealiseerd.toLocaleString('nl-NL'), options: { fill: { color: bg }, align: 'center' } },
        { text: loc.contacten.toString(),                 options: { fill: { color: bg }, align: 'center' } },
        { text: `${pct}%`, options: { fill: { color: bg }, align: 'center', bold: pct >= 100, color: pct >= 100 ? '0F7B3A' : C.darkgrey } },
      ]);
    });
    s.addTable(rows, {
      x: 0.4, y: 1.05, w: 5.7,
      colW: [1.85, 0.8, 1.1, 0.95, 0.75],
      border: { pt: 0.5, color: 'D8D8D8' },
      fontSize: 12, fontFace: 'Tungsten Book', rowH: 0.48,
    });
    s.addChart(pres.charts.BAR, [
      { name: 'Doel',         labels: data.locaties.map(l => l.naam), values: data.locaties.map(l => l.doel) },
      { name: 'Gerealiseerd', labels: data.locaties.map(l => l.naam), values: data.locaties.map(l => l.gerealiseerd) },
    ], {
      x: 6.2, y: 0.85, w: 3.6, h: 3.6,
      barDir: 'bar', barGrouping: 'clustered',
      chartColors: [C.greyblue, C.navy],
      chartArea: { fill: { color: C.lightbg }, roundedCorners: false },
      catAxisLabelColor: '555555', valAxisLabelColor: '555555',
      valGridLine: { color: 'DDDDDD', size: 0.5 }, catGridLine: { style: 'none' },
      showLegend: true, legendPos: 'b', legendFontSize: 10,
    });
    addLogo(s);
    addPageNum(s, 4);
  }

  // SLIDE 5 — VERLOOP VAN DE ACTIE
  {
    const s = pres.addSlide();
    s.background = { color: C.white };
    slideTitle(s, 'VERLOOP VAN DE ACTIE');
    data.verloop.forEach((item, i) => {
      const y = 1.1 + i * 1.3;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: 0.4, y, w: 5.4, h: 1.12,
        fill: { color: C.lightbg }, line: { color: 'DDDDDD', width: 0.5 }, rectRadius: 0.07,
        shadow: { type: 'outer', color: '000000', blur: 5, offset: 1, angle: 90, opacity: 0.05 },
      });
      s.addText(item.label.toUpperCase(), {
        x: 0.65, y: y + 0.1, w: 2, h: 0.28,
        fontSize: 14, bold: true, color: C.navy,
        fontFace: 'Tungsten Book', margin: 0,
      });
      s.addText(item.tekst, {
        x: 0.65, y: y + 0.38, w: 4.95, h: 0.65,
        fontSize: 12, color: C.darkgrey, fontFace: 'Arial',
        valign: 'top', margin: 0,
      });
    });
    addLogo(s);
    addPageNum(s, 5);
  }

  // SLIDE 6 — TERUGBLIK
  {
    const s = pres.addSlide();
    s.background = { color: C.lightbg };
    slideTitle(s, 'TERUGBLIK');
    const cols = [
      { label: 'WAT GING GOED', items: data.goedGegaan,     bgCard: C.navy,  textColor: C.white, labelColor: C.yellow },
      { label: 'WAT KAN BETER', items: data.verbeterpunten,  bgCard: C.white, textColor: C.navy,  labelColor: C.navy  },
    ];
    cols.forEach((col, i) => {
      const x = 0.4 + i * 4.78;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y: 1.05, w: 4.45, h: 4.2,
        fill: { color: col.bgCard }, line: { color: col.bgCard, width: 0 }, rectRadius: 0.1,
        shadow: { type: 'outer', color: '000000', blur: 10, offset: 3, angle: 90, opacity: 0.08 },
      });
      s.addText(col.label, {
        x: x + 0.28, y: 1.22, w: 3.9, h: 0.35,
        fontSize: 14, bold: true, color: col.labelColor,
        fontFace: 'Tungsten Book', margin: 0,
      });
      const items = col.items.map((item, idx) => ([
        { text: '›  ', options: { bold: true, color: col.labelColor } },
        { text: item + (idx < col.items.length - 1 ? '\n' : ''), options: { color: col.textColor } },
      ])).flat();
      s.addText(items, {
        x: x + 0.28, y: 1.68, w: 3.9, h: 3.3,
        fontSize: 12, fontFace: 'Arial', valign: 'top',
        paraSpaceAfter: 10, margin: 0, lineSpacingMultiple: 1.25,
      });
    });
    addLogo(s);
    addPageNum(s, 6);
  }

  // SLIDE 7 — ACTIEPUNTEN
  {
    const s = pres.addSlide();
    s.background = { color: C.white };
    slideTitle(s, 'ACTIEPUNTEN');
    s.addText('VOLGENDE EDITIE', {
      x: 0.5, y: 0.78, w: 9, h: 0.3,
      fontSize: 14, bold: true, color: C.greyblue, fontFace: 'Tungsten Book', margin: 0,
    });
    data.actiepunten.forEach((actie, i) => {
      const y = 1.32 + i * 1.1;
      s.addShape(pres.shapes.OVAL, {
        x: 0.4, y: y + 0.04, w: 0.5, h: 0.5,
        fill: { color: C.yellow }, line: { color: C.yellow, width: 0 },
      });
      s.addText(`${i + 1}`, {
        x: 0.4, y: y + 0.04, w: 0.5, h: 0.5,
        fontSize: 15, bold: true, color: C.navy,
        fontFace: 'Tungsten Bold', align: 'center', valign: 'middle', margin: 0,
      });
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: 1.1, y, w: 8.5, h: 0.6,
        fill: { color: 'F5F5F5' }, line: { color: 'EEEEEE', width: 0.5 }, rectRadius: 0.06,
      });
      s.addText(actie, {
        x: 1.35, y, w: 8.1, h: 0.6,
        fontSize: 12, color: C.navy, fontFace: 'Arial', valign: 'middle', margin: 0,
      });
    });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.4, y: 4.88, w: 2.2, h: 0.34,
      fill: { color: C.navy }, line: { color: C.navy, width: 0 }, rectRadius: 0.04,
    });
    s.addText('FOLLOW-UP VEREIST', {
      x: 0.4, y: 4.88, w: 2.2, h: 0.34,
      fontSize: 9, bold: true, charSpacing: 1, color: C.yellow,
      fontFace: 'Tungsten Bold', align: 'center', valign: 'middle', margin: 0,
    });
    addLogo(s);
    addPageNum(s, 7);
  }

  // SLIDE 8 — EINDSLIDE
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 0.5, h: 5.625,
      fill: { color: C.yellow }, line: { color: C.yellow, width: 0 },
    });
    s.addText(data.campagne.toUpperCase(), {
      x: 0.8, y: 3.5, w: 5.5, h: 0.85,
      fontSize: 22, bold: true, color: C.white,
      fontFace: 'Tungsten Book', align: 'left', margin: 0,
    });
    s.addText(`${data.klant}  ·  ${data.datum}`, {
      x: 0.8, y: 4.38, w: 5.5, h: 0.35,
      fontSize: 12, color: C.greyblue, fontFace: 'Arial', margin: 0,
    });
    s.addImage({ path: LOGO_DIAP, x: 8.53, y: 5.08, w: 1.8, h: 0.44,
      sizing: { type: 'contain', w: 1.8, h: 0.44 } });
    addPageNum(s, 8);
  }

  return await pres.write({ outputType: 'nodebuffer' });
}
