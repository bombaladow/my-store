import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { subject: rawSubject, message: rawMessage, password: rawPassword } = await request.json();
  const subject = String(rawSubject || '').trim();
  const message = String(rawMessage || '').trim();
  const password = String(rawPassword || '');
  const adminPassword = process.env.ADMIN_PASSWORD || 'mono2026';

  if (password !== adminPassword) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!subject || !message) {
    return NextResponse.json({ error: 'Missing subject or message' }, { status: 400 });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY || !process.env.RESEND_KEY) {
    return NextResponse.json({ error: 'Missing server configuration' }, { status: 500 });
  }

  try {
    const subscribersRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/subscribers?select=email`, {
      headers: {
        apikey: process.env.SUPABASE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
      },
    });

    if (!subscribersRes.ok) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const subscribers = await subscribersRes.json();
    const emails = subscribers.map((subscriber: { email?: string }) => subscriber.email).filter(Boolean);

    if (!emails.length) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_KEY}`,
      },
      body: JSON.stringify({
        from: 'MONO <onboarding@resend.dev>',
        to: emails,
        subject,
        html: updateTemplate({ subject, message }),
      }),
    });

    if (!emailRes.ok) {
      return NextResponse.json({ error: 'Email send failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, sent: emails.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

function updateTemplate({ subject, message }: { subject: string; message: string }) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;background:#f9f9f7;color:#0a0a0a;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:56px 32px">
    <div style="font-size:28px;letter-spacing:.35em;margin-bottom:40px">MONO</div>
    <h1 style="font-size:24px;font-weight:400;margin:0 0 20px">${escapeHtml(subject)}</h1>
    <div style="font-size:15px;line-height:1.8;color:#333;white-space:pre-line">${escapeHtml(message)}</div>
    <hr style="border:none;border-top:1px solid #e8e8e5;margin:40px 0">
    <p style="font-size:12px;color:#888;letter-spacing:.06em">© 2026 MONO</p>
  </div>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
