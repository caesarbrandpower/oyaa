import { google } from 'googleapis';
import { Readable } from 'node:stream';
import { normalizeClientName } from '@/lib/utils';

const DRIVE_SUBFOLDER = {
  'meeting-summary':  'Transcripts',
  'evaluation':       'Evaluaties',
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

/**
 * Upload een buffer naar Google Drive.
 *
 * @param {Buffer} buffer - Bestandsinhoud
 * @param {{ fileName: string, clientName?: string|null, outputType?: string|null, rootFolderId: string, mimeType?: string }} opts
 * @returns {Promise<{ id: string, name: string }>}
 */
export async function uploadToDrive(buffer, { fileName, clientName = null, outputType = null, rootFolderId, mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
    throw new Error('Google OAuth credentials ontbreken');
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
  const typeFolderId   = await getOrCreateFolder(drive, subFolderName, clientFolderId);

  const res = await drive.files.create({
    fields: 'id,name',
    requestBody: {
      name: fileName,
      parents: [typeFolderId],
      mimeType,
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
  });

  console.log('[DRIVE] upload geslaagd — file.id:', res.data?.id, '— file.name:', res.data?.name);
  return { id: res.data?.id, name: res.data?.name };
}
