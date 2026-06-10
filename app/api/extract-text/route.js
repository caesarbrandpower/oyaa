// app/api/extract-text/route.js
export const runtime = 'nodejs';

import { createClient } from '@/lib/supabase-server';
import { extractFileText } from '@/lib/extract-file-text';

const MAX_CHARS = 12000;

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) return Response.json({ error: 'Geen bestand.' }, { status: 400 });

  const filename = file.name;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    let text = await extractFileText(buffer, filename);
    if (text.length > MAX_CHARS) {
      text = text.slice(0, MAX_CHARS) + '\n\n[Tekst afgekapt na 12.000 tekens]';
    }
    return Response.json({ text: text.trim(), filename });
  } catch (err) {
    console.error('[extract-text] error:', err);
    const known = /niet ondersteund/.test(err?.message ?? '');
    return Response.json(
      { error: known ? err.message : `Fout bij uitlezen: ${err?.message ?? String(err)}` },
      { status: known ? 400 : 500 }
    );
  }
}
