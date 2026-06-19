import { google } from 'googleapis';
import { Readable } from 'node:stream';
import { normalizeClientName } from './utils';
import { buildWordBuffer } from './doc-word';

const DRIVE_SUBFOLDER = {
  'meeting-summary': 'Transcripts',
  'evaluation': 'Evaluaties',
  'external-debrief': 'Evaluaties',
};

async function getOrCreateFolder(drive, name, parentId) {
  const q = `name = ${JSON.stringify(name)} and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`;
  const list = await drive.files.list({ q, fields: 'files(id)', pageSize: 1, spaces: 'drive' });
  if (list.data.files?.length) return list.data.files[0].id;
  const created = await drive.files.create({
    fields: 'id',
    requestBody: { name, parents: [parentId], mimeType: 'application/vnd.google-apps.folder' },
  });
  console.log('[DRIVE] map aangemaakt:', name, '— id:', created.data.id);
  return created.data.id;
}

export async function uploadToDrive(content, fileName, { rootFolderId, clientName, outputType, typeLabel = null, rawTranscript = null }) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
    throw new Error('GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET of GOOGLE_REFRESH_TOKEN ontbreekt');
  }

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  const drive = google.drive({ version: 'v3', auth });

  const normalizedClient = clientName ? normalizeClientName(clientName) : null;
  const clientFolderName = normalizedClient || 'Overige';
  const subFolderName = DRIVE_SUBFOLDER[outputType] ?? 'Briefings';

  const clientFolderId = await getOrCreateFolder(drive, clientFolderName, rootFolderId);
  const typeFolderId = await getOrCreateFolder(drive, subFolderName, clientFolderId);

  const buffer = await buildWordBuffer(content, { outputType, clientName: normalizedClient, typeLabel });

  console.log('[DRIVE] upload starten:', fileName, '— map:', clientFolderName, '/', subFolderName);

  let res;
  try {
    res = await drive.files.create({
      fields: 'id,name',
      requestBody: {
        name: fileName,
        parents: [typeFolderId],
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

  if (rawTranscript && outputType === 'meeting-summary') {
    const transcriptName = fileName.replace(/\.docx$/, '_transcript.txt');
    try {
      const txtRes = await drive.files.create({
        fields: 'id,name',
        requestBody: {
          name: transcriptName,
          parents: [typeFolderId],
          mimeType: 'text/plain',
        },
        media: {
          mimeType: 'text/plain',
          body: Readable.from(Buffer.from(rawTranscript, 'utf-8')),
        },
      });
      console.log('[DRIVE] transcript geüpload — file.id:', txtRes.data?.id, '— file.name:', txtRes.data?.name);
    } catch (err) {
      const detail = err?.response?.data ?? err?.errors ?? err?.message ?? err;
      console.error('[DRIVE] transcript upload mislukt — status:', err?.response?.status, '— detail:', JSON.stringify(detail));
    }
  }

  return res.data;
}
