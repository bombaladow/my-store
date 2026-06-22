export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { subject, message, password } = req.body || {};

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!subject?.trim() || !message?.trim()) {
    return res.status(400).json({ error: 'Missing subject or message' });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY || !process.env.RESEND_KEY) {
    return res.status(500).json({ error: 'Missing server configuration' });
  }

  const subscribersRes = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/subscribers?select=email&order=created_at.desc`,
    {
      headers: {
        'apikey': process.env.SUPABASE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
      }
    }
  );

  if (!subscribersRes.ok) {
    return res.status(500).json({ error: 'Failed to load subscribers' });
  }

  const subscribers = await subscribersRes.json();
  const emails = subscribers.map(s => s.email).filter(Boolean);

  if (!emails.length) {
    return res.status(200).json({ success: true, sent: 0 });
  }

  const results = await Promise.allSettled(
    emails.map(email => fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_KEY}`
      },
      body: JSON.stringify({
        from: 'MONO <onboarding@resend.dev>',
        to: email,
        subject: subject.trim(),
        html: updateTemplate({ message: message.trim() })
      })
    }))
  );

  const sent = results.filter(result => result.status === 'fulfilled' && result.value.ok).length;

  return res.status(200).json({ success: true, sent });
}

function updateTemplate({ message }) {
  const body = escapeHTML(message).replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;background:#f9f9f7;font-family:Arial,sans-serif;color:#0a0a0a">
  <div style="max-width:580px;margin:0 auto;padding:56px 40px">
    <div style="font-size:28px;letter-spacing:.35em;margin-bottom:40px">MONO</div>
    <div style="background:#fff;border:1px solid #e8e8e5;padding:28px;line-height:1.8;font-size:14px">
      ${body}
    </div>
    <p style="margin-top:32px;color:#888;font-size:12px;letter-spacing:.05em">MONO updates</p>
  </div>
</body>
</html>`;
}

function escapeHTML(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
