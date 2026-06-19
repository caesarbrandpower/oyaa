import { NextResponse } from 'next/server';
import { uploadToDrive } from '@/lib/google-drive';

export async function POST(request) {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Ongeldige form data' }, { status: 400 });
  }

  const docxBlob    = formData.get('file');
  const fileName    = formData.get('fileName');
  const clientName  = formData.get('clientName') || null;
  const outputType  = formData.get('outputType') || null;
  const rootFolderId = formData.get('rootFolderId');

  if (!docxBlob || !fileName || !rootFolderId) {
    return NextResponse.json({ error: 'file, fileName en rootFolderId zijn verplicht' }, { status: 400 });
  }

  try {
    const arrayBuffer = await docxBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const result = await uploadToDrive(buffer, { fileName, clientName, outputType, rootFolderId });
    return NextResponse.json(result);
  } catch (err) {
    const detail = err?.response?.data ?? err?.message ?? err;
    console.error('[DRIVE] upload mislukt:', JSON.stringify(detail));
    return NextResponse.json({ error: 'Upload mislukt' }, { status: 500 });
  }
}
