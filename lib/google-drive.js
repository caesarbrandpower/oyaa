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
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!rawKey) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY ontbreekt');

  const credentials = JSON.parse(rawKey);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  const drive = google.drive({ version: 'v3', auth });

  const doc = new Document({
    sections: [{ children: contentToDocxParagraphs(content) }],
  });
  const buffer = await Packer.toBuffer(doc);

  const res = await drive.files.create({
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

  return res.data;
}
