// lib/embed-fonts.js
// Pure Node.js font embedding voor PPTX via JSZip + @xmldom/xmldom.
// Voegt Tungsten font-binaries toe aan de OOXML-structuur zodat
// PowerPoint de fonts meeneemt ook als ze niet op de doelmachine staan.

import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const P_NS   = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const A_NS   = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const R_NS   = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CT_NS  = 'http://schemas.openxmlformats.org/package/2006/content-types';
const FONT_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/font';
const CT_FONT = 'application/x-fontdata';

const FONTS = [
  { name: 'Tungsten Bold',     file: 'Tungsten-Bold.otf',     variant: 'regular' },
  { name: 'Tungsten Book',     file: 'Tungsten-Book.otf',     variant: 'regular' },
  { name: 'Tungsten SemiBold', file: 'Tungsten-Semibold.otf', variant: 'regular' },
];

const parser     = new DOMParser();
const serializer = new XMLSerializer();

function parseXml(str) {
  return parser.parseFromString(str, 'text/xml');
}

function serializeXml(doc) {
  return serializer.serializeToString(doc);
}

export async function embedFonts(pptxBuffer) {
  const zip = await JSZip.loadAsync(pptxBuffer);

  // ── Lees bestaande XML-bestanden ────────────────────────────────────────────
  const prsXml   = await zip.file('ppt/presentation.xml').async('string');
  const relsXml  = await zip.file('ppt/_rels/presentation.xml.rels').async('string');
  const ctXml    = await zip.file('[Content_Types].xml').async('string');

  const prsDoc   = parseXml(prsXml);
  const relsDoc  = parseXml(relsXml);
  const ctDoc    = parseXml(ctXml);

  const prsRoot  = prsDoc.documentElement;
  const relsRoot = relsDoc.documentElement;
  const ctRoot   = ctDoc.documentElement;

  // ── [Content_Types].xml: voeg odttf toe als die er nog niet is ───────────
  const existingDefaults = Array.from(ctRoot.getElementsByTagNameNS(CT_NS, 'Default'))
    .map(el => el.getAttribute('Extension'));
  if (!existingDefaults.includes('odttf')) {
    const defaultEl = ctDoc.createElementNS(CT_NS, 'Default');
    defaultEl.setAttribute('Extension', 'odttf');
    defaultEl.setAttribute('ContentType', CT_FONT);
    ctRoot.appendChild(defaultEl);
  }

  // ── Bestaande rel-ID's ophalen om conflicten te vermijden ────────────────
  const existingIds = new Set(
    Array.from(relsRoot.getElementsByTagNameNS(REL_NS, 'Relationship'))
      .map(el => el.getAttribute('Id'))
  );
  let relCounter = 200;
  function nextRelId() {
    while (existingIds.has(`rFontId${relCounter}`)) relCounter++;
    const id = `rFontId${relCounter}`;
    existingIds.add(id);
    relCounter++;
    return id;
  }

  // ── embeddedFontLst: zoek of maak aan ────────────────────────────────────
  let fontLst = prsRoot.getElementsByTagNameNS(P_NS, 'embeddedFontLst')[0];
  if (!fontLst) {
    fontLst = prsDoc.createElementNS(P_NS, 'p:embeddedFontLst');
    prsRoot.appendChild(fontLst);
  }

  // ── Verwerk elk font ──────────────────────────────────────────────────────
  const fontsDir = path.resolve(process.cwd(), 'public/fonts');

  for (const { name, file, variant } of FONTS) {
    const fontPath = path.join(fontsDir, file);
    let fontBytes;
    try {
      fontBytes = await readFile(fontPath);
    } catch {
      console.warn(`[PPTX] font niet gevonden, overgeslagen: ${fontPath}`);
      continue;
    }

    const relId        = nextRelId();
    const fontFilename = `${relId}.odttf`;
    const zipPath      = `ppt/fonts/${fontFilename}`;

    // Voeg font binary toe aan ZIP
    zip.file(zipPath, fontBytes);

    // Relationship in presentation.xml.rels
    const relEl = relsDoc.createElementNS(REL_NS, 'Relationship');
    relEl.setAttribute('Id',     relId);
    relEl.setAttribute('Type',   FONT_REL_TYPE);
    relEl.setAttribute('Target', `fonts/${fontFilename}`);
    relsRoot.appendChild(relEl);

    // <p:embeddedFont> in presentation.xml
    const fontEl  = prsDoc.createElementNS(P_NS, 'p:embeddedFont');
    const fontDef = prsDoc.createElementNS(A_NS, 'a:font');
    fontDef.setAttribute('typeface', name);
    fontDef.setAttribute('charset',  '0');
    fontEl.appendChild(fontDef);

    const variantEl = prsDoc.createElementNS(P_NS, `p:${variant}`);
    variantEl.setAttributeNS(R_NS, 'r:id', relId);
    fontEl.appendChild(variantEl);

    fontLst.appendChild(fontEl);
  }

  // ── Schrijf gewijzigde XML terug ─────────────────────────────────────────
  zip.file('ppt/presentation.xml',            serializeXml(prsDoc));
  zip.file('ppt/_rels/presentation.xml.rels', serializeXml(relsDoc));
  zip.file('[Content_Types].xml',             serializeXml(ctDoc));

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
