// app/api/feedback/route.js
import { createClient } from '@/lib/supabase-server';

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Ongeldig verzoek.' }, { status: 400 });
  }

  const { message, currentUrl } = body;
  if (!message?.trim()) {
    return Response.json({ error: 'Bericht is verplicht.' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  console.log('[feedback] RESEND_API_KEY aanwezig:', !!apiKey, '| lengte:', apiKey?.length ?? 0);

  const emailHtml = `
    <p><strong>Feedback van:</strong> ${user.email}</p>
    <p><strong>Pagina:</strong> ${currentUrl || 'onbekend'}</p>
    <hr />
    <p>${message.trim().replace(/\n/g, '<br />')}</p>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: 'Waybetter Feedback <onboarding@resend.dev>',
      to: 'mailtocaesar@gmail.com',
      subject: `Feedback van ${user.email}`,
      html: emailHtml,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[feedback] Resend status:', res.status, '| body:', err);
    return Response.json({ error: 'Verzenden mislukt.' }, { status: 500 });
  }

  return Response.json({ ok: true });
}
