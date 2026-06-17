// lib/google-drive.js
// Upload gegenereerde documenten naar Google Drive via een service account.
// Tenant-config vereist: google_drive.enabled + google_drive.folder_id.
// De service account heeft editor-toegang tot de gedeelde map nodig.

import { google } from 'googleapis';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { Readable } from 'node:stream';

function contentToDocxParagraphs(content) {
  const paragraphs = [];
  for (const line of content.split('\n')) {
    if (line.startsWith('### ')) {
      paragraphs.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }));
    } else if (line.startsWith('## ')) {
      paragraphs.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
    } else if (line.startsWith('# ')) {
      paragraphs.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }));
    } else if (line.trim() === '') {
      paragraphs.push(new Paragraph({ text: '' }));
    } else {
      // Verwijder markdown bold/italic markers voor leesbare platte tekst
      const text = line.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/^[-*]\s+/, '• ');
      paragraphs.push(new Paragraph({ children: [new TextRun(text)] }));
    }
  }
  return paragraphs;
}

export async function uploadToDrive(content, fileName, folderId) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
    throw new Error('GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET of GOOGLE_REFRESH_TOKEN ontbreekt');
  }

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

  const drive = google.drive({ version: 'v3', auth });

  const doc = new Document({
    sections: [{ children: contentToDocxParagraphs(content) }],
  });
  const buffer = await Packer.toBuffer(doc);

  console.log('[DRIVE] upload starten naar folder:', folderId, '— bestand:', fileName);

  let res;
  try {
    res = await drive.files.create({
      fields: 'id,name',
      requestBody: {
        name: fileName,
        parents: [folderId],
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
      media: {
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        body: Readable.from(buffer),
      },
    });
  } catch (err) {
    const detail = err?.response?.data ?? err?.errors ?? err?.message ?? err;
    console.error('[DRIVE] files.create mislukt — status:', err?.response?.status, '— detail:', JSON.stringify(detail));
    throw err;
  }

  console.log('[DRIVE] upload geslaagd — file.id:', res.data?.id, '— file.name:', res.data?.name);
  return res.data;
}
