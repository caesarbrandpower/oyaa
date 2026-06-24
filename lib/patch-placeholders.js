// lib/patch-placeholders.js
// Voegt foto's (of native PowerPoint placeholders) toe aan de evaluatie-PPTX.
// Werkt via JSZip + @xmldom/xmldom zonder child_process of Python.

import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const P_NS   = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const A_NS   = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const R_NS   = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CT_NS  = 'http://schemas.openxmlformats.org/package/2006/content-types';
const IMG_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';

const EMU = 914400;

const PHOTOS = [
  {
    field:           'foto_voor',
    slideNum:        1,
    x: 5.775, y: 0.662, w: 3.85, h: 4.3,
    spId:            200,
    idx:             10,
    insertFirst:     false,
  },
  {
    field:           'foto_midden',
    slideNum:        5,
    x: 6.1, y: 1.0, w: 3.65, h: 3.85,
    spId:            201,
    idx:             11,
    insertFirst:     false,
    removeLabel:     'actiefoto',
  },
  {
    field:           'foto_achter',
    slideNum:        8,
    x: 0.5, y: 0.0, w: 9.5, h: 5.625,
    spId:            202,
    idx:             12,
    insertFirst:     true,
  },
];

const parser     = new DOMParser();
const serializer = new XMLSerializer();

function emu(inches) {
  return Math.round(inches * EMU);
}

function makePlaceholderXml(spId, idx, x, y, w, h) {
  return `<p:sp xmlns:p="${P_NS}" xmlns:a="${A_NS}"><p:nvSpPr><p:cNvPr id="${spId}" name="Afbeelding ${idx}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="pic" idx="${idx}"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`;
}

// Leest native breedte/hoogte uit JPEG of PNG zonder externe library.
function getImageDimensions(b64, mimeType) {
  try {
    const buf = Buffer.from(b64, 'base64');
    if (mimeType === 'image/png') {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
      let i = 2;
      while (i < buf.length - 8) {
        if (buf[i] !== 0xFF) { i++; continue; }
        const marker = buf[i + 1];
        // SOF0-SOF3, SOF5-SOF7, SOF9-SOF11, SOF13-SOF15
        if ([0xC0,0xC1,0xC2,0xC3,0xC5,0xC6,0xC7,0xC9,0xCA,0xCB,0xCD,0xCE,0xCF].includes(marker)) {
          return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
  } catch { /* ignore — onbekend formaat */ }
  return null;
}

// Berekent <a:srcRect> waarden (0-100000) voor cover-gedrag:
// schaalt zodat het kader gevuld wordt, snijdt overschietende randen bij.
function coverSrcRect(imgW, imgH, frameW, frameH) {
  const imgRatio   = imgW / imgH;
  const frameRatio = frameW / frameH;
  if (imgRatio > frameRatio) {
    // Foto breder dan kader — schaal op hoogte, knip zijkanten bij
    const v = Math.round((imgRatio - frameRatio) / (2 * imgRatio) * 100000);
    return { l: v, t: 0, r: v, b: 0 };
  } else {
    // Foto hoger dan kader — schaal op breedte, knip boven/onder bij
    const v = Math.round((1 - imgRatio / frameRatio) / 2 * 100000);
    return { l: 0, t: v, r: 0, b: v };
  }
}

function makePicXml(spId, idx, relId, x, y, w, h, srcRect = null) {
  const blipFill = srcRect
    ? `<a:blip r:embed="${relId}"/><a:srcRect l="${srcRect.l}" t="${srcRect.t}" r="${srcRect.r}" b="${srcRect.b}"/><a:stretch><a:fillRect/></a:stretch>`
    : `<a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch>`;
  return `<p:pic xmlns:p="${P_NS}" xmlns:a="${A_NS}" xmlns:r="${R_NS}"><p:nvPicPr><p:cNvPr id="${spId}" name="Afbeelding ${idx}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill>${blipFill}</p:blipFill><p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}

function insertIntoSpTree(spTree, el, first) {
  if (!first) {
    spTree.appendChild(el);
    return;
  }
  const firstContent = Array.from(spTree.childNodes).find(
    (n) => n.nodeType === 1 && n.nodeName !== 'p:nvGrpSpPr' && n.nodeName !== 'p:grpSpPr'
  );
  if (firstContent) {
    spTree.insertBefore(el, firstContent);
  } else {
    spTree.appendChild(el);
  }
}

function nextRelId(relsRoot) {
  const rels = Array.from(relsRoot.getElementsByTagNameNS(REL_NS, 'Relationship'));
  const max  = rels.reduce((m, r) => {
    const n = parseInt((r.getAttribute('Id') ?? '').replace(/\D/g, ''), 10) || 0;
    return Math.max(m, n);
  }, 0);
  return `rId${max + 1}`;
}

function ensureContentType(ctRoot, ctDoc, ext, contentType) {
  const exists = Array.from(ctRoot.getElementsByTagNameNS(CT_NS, 'Default'))
    .some((el) => el.getAttribute('Extension') === ext);
  if (exists) return;
  const el = ctDoc.createElementNS(CT_NS, 'Default');
  el.setAttribute('Extension',   ext);
  el.setAttribute('ContentType', contentType);
  ctRoot.appendChild(el);
}

export async function addPhotoPlaceholders(pptxBuffer, data) {
  if (!data) return pptxBuffer;

  const hasAnyPhoto = PHOTOS.some((p) => data[p.field]);
  if (!hasAnyPhoto) {
    // Geen foto's — voeg alleen placeholders toe
  }

  const zip = await JSZip.loadAsync(pptxBuffer);

  // [Content_Types].xml — zorg dat jpg/png als default staan
  const ctXml  = await zip.file('[Content_Types].xml').async('string');
  const ctDoc  = parser.parseFromString(ctXml, 'text/xml');
  const ctRoot = ctDoc.documentElement;
  ensureContentType(ctRoot, ctDoc, 'jpg',  'image/jpeg');
  ensureContentType(ctRoot, ctDoc, 'jpeg', 'image/jpeg');
  ensureContentType(ctRoot, ctDoc, 'png',  'image/png');

  // Telt bestaande media-bestanden om unieke bestandsnamen te genereren
  let mediaCounter = Object.keys(zip.files).filter((f) => f.startsWith('ppt/media/')).length + 1;

  for (const photo of PHOTOS) {
    const { field, slideNum, x, y, w, h, spId, idx, insertFirst, removeLabel } = photo;

    const slideFile = `ppt/slides/slide${slideNum}.xml`;
    const relsFile  = `ppt/slides/_rels/slide${slideNum}.xml.rels`;

    const slideXml = await zip.file(slideFile)?.async('string');
    if (!slideXml) continue;

    const slideDoc  = parser.parseFromString(slideXml, 'text/xml');
    const spTree    = slideDoc.getElementsByTagNameNS(P_NS, 'spTree')[0];
    if (!spTree) continue;

    // Verwijder shapes met bepaald label (slide 5: actiefoto-placeholder)
    if (removeLabel) {
      const shapes = Array.from(spTree.childNodes).filter(
        (n) => n.nodeType === 1 && n.nodeName === 'p:sp'
      );
      for (const sp of shapes) {
        const tNodes = sp.getElementsByTagNameNS(A_NS, 't');
        const text   = Array.from(tNodes).map((t) => t.textContent).join('').toLowerCase();
        if (text.includes(removeLabel)) {
          spTree.removeChild(sp);
        }
      }
    }

    const base64Data = data[field] ?? null;

    let newEl;

    if (base64Data) {
      // Echte afbeelding: base64 data-URI → binary + toevoegen aan ZIP
      const match = base64Data.match(/^data:([^;]+);base64,(.+)$/s);
      if (!match) {
        // Ongeldig formaat — val terug op placeholder
        const ph = parser.parseFromString(makePlaceholderXml(spId, idx, x, y, w, h), 'text/xml').documentElement;
        newEl = slideDoc.importNode(ph, true);
      } else {
        const mimeType = match[1];
        const b64      = match[2];
        const ext      = mimeType === 'image/png' ? 'png' : 'jpg';
        const filename = `image${mediaCounter++}.${ext}`;
        const zipPath  = `ppt/media/${filename}`;

        zip.file(zipPath, Buffer.from(b64, 'base64'));

        const dims   = getImageDimensions(b64, mimeType);
        const srcRect = dims ? coverSrcRect(dims.width, dims.height, w, h) : null;

        // Slide rels — voeg image-relatie toe
        const existingRels = await zip.file(relsFile)?.async('string');
        const relsDoc = existingRels
          ? parser.parseFromString(existingRels, 'text/xml')
          : parser.parseFromString(
              `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${REL_NS}"></Relationships>`,
              'text/xml'
            );
        const relsRoot = relsDoc.documentElement;
        const relId    = nextRelId(relsRoot);

        const relEl = relsDoc.createElementNS(REL_NS, 'Relationship');
        relEl.setAttribute('Id',     relId);
        relEl.setAttribute('Type',   IMG_REL_TYPE);
        relEl.setAttribute('Target', `../media/${filename}`);
        relsRoot.appendChild(relEl);

        zip.file(relsFile, serializer.serializeToString(relsDoc));

        const pic = parser.parseFromString(makePicXml(spId, idx, relId, x, y, w, h, srcRect), 'text/xml').documentElement;
        newEl = slideDoc.importNode(pic, true);
      }
    } else {
      // Native placeholder (geen afbeelding beschikbaar)
      const ph = parser.parseFromString(makePlaceholderXml(spId, idx, x, y, w, h), 'text/xml').documentElement;
      newEl = slideDoc.importNode(ph, true);
    }

    insertIntoSpTree(spTree, newEl, insertFirst);
    zip.file(slideFile, serializer.serializeToString(slideDoc));
  }

  zip.file('[Content_Types].xml', serializer.serializeToString(ctDoc));

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
