import { createClient } from '@/lib/supabase-server';
import { buildPresentation } from '@/lib/generate-pptx';
import { getTenant } from '@/lib/get-tenant';
import { uploadToDrive } from '@/lib/google-drive';
import { execFile } from 'node:child_process';
import { writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';

async function fetchAsDataUri(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Foto ophalen mislukt: ${url} (${res.status})`);
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return `data:${contentType};base64,${base64}`;
}

function sanitizeFilename(str) {
  return str.replace(/[^a-zA-Z0-9\-_\s]/g, '').replace(/\s+/g, '_').slice(0, 80);
}

async function embedFonts(buffer) {
  const tmpIn  = `/tmp/eval-${Date.now()}.pptx`;
  const tmpOut = `/tmp/eval-final-${Date.now()}.pptx`;
  const script = path.resolve(process.cwd(), 'lib/embed-fonts.py');

  try {
    await writeFile(tmpIn, buffer);
    await new Promise((resolve, reject) => {
      execFile('python3', [script, tmpIn, tmpOut], { timeout: 30000 }, (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve(stdout);
      });
    });
    const result = await readFile(tmpOut);
    return result;
  } finally {
    await unlink(tmpIn).catch(() => {});
    await unlink(tmpOut).catch(() => {});
  }
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Ongeldige JSON body.' }, { status: 400 });
  }

  if (!body?.campagne || !body?.klant) {
    return Response.json({ error: 'campagne en klant zijn verplicht.' }, { status: 400 });
  }

  try {
    const data = { ...body };

    for (const field of ['foto_product', 'foto_actie1', 'foto_actie2']) {
      if (data[field] && typeof data[field] === 'string' && data[field].startsWith('http')) {
        data[field] = await fetchAsDataUri(data[field]);
      }
    }

    const rawBuffer = await buildPresentation(data);

    // Font embedding via Python post-processing; fallback op originele buffer als het mislukt
    let buffer = rawBuffer;
    try {
      buffer = await embedFonts(rawBuffer);
    } catch (err) {
      console.error('[PPTX] font embedding mislukt, terug naar origineel:', err?.message ?? err);
    }

    const filename = `Chase_Evaluatie_${sanitizeFilename(data.campagne)}.pptx`;

    // Fire-and-forget Drive upload — vertraagt de response niet
    getTenant().then((tenant) => {
      const driveConfig = tenant?.tenant_config?.google_drive;
      if (!driveConfig?.enabled || !driveConfig?.folder_id) return;
      return uploadToDrive(buffer, {
        fileName:     filename,
        clientName:   data.klant,
        outputType:   'evaluation',
        rootFolderId: driveConfig.folder_id,
        mimeType:     'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });
    }).catch((err) => {
      console.error('[DRIVE] pptx upload mislukt:', err?.message ?? err);
    });

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (err) {
    console.error('[generate-pptx] fout:', err?.message ?? err);
    return Response.json({ error: 'Presentatie genereren mislukt.' }, { status: 500 });
  }
}
