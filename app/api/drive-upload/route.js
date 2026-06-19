import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'node:stream';
import { normalizeClientName } from '@/lib/utils';

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

export async function POST(request) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
    return NextResponse.json({ error: 'Google OAuth credentials ontbreken' }, { status: 500 });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Ongeldige form data' }, { status: 400 });
  }

  const docxBlob = formData.get('file');
  const fileName = formData.get('fileName');
  const clientName = formData.get('clientName') || null;
  const outputType = formData.get('outputType') || null;
  const rootFolderId = formData.get('rootFolderId');

  if (!docxBlob || !fileName || !rootFolderId) {
    return NextResponse.json({ error: 'file, fileName en rootFolderId zijn verplicht' }, { status: 400 });
  }

  try {
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

    const arrayBuffer = await docxBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const res = await drive.files.create({
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

    console.log('[DRIVE] upload geslaagd — file.id:', res.data?.id, '— file.name:', res.data?.name);
    return NextResponse.json({ id: res.data?.id, name: res.data?.name });
  } catch (err) {
    const detail = err?.response?.data ?? err?.message ?? err;
    console.error('[DRIVE] upload mislukt:', JSON.stringify(detail));
    return NextResponse.json({ error: 'Upload mislukt' }, { status: 500 });
  }
}
