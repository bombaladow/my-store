export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const ADMIN_EMAIL = 'bombaladow@gmail.com';
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const RESEND_KEY = process.env.RESEND_KEY;

  // ── 1) التأكد إن الطلب جاي من الأدمن فعلاً ──
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing authorization token' });

  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${token}` }
    });
    if (!userRes.ok) return res.status(401).json({ error: 'Invalid or expired session' });

    const user = await userRes.json();
    if ((user.email || '').toLowerCase().trim() !== ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Not authorized' });
    }
  } catch (e) {
    console.error('Admin check failed:', e);
    return res.status(500).json({ error: 'Auth check failed' });
  }

  // ── 2) التحقق من محتوى الرسالة ──
  const { subject, message } = req.body;
  if (!subject || !message) {
    return res.status(400).json({ error: 'Missing subject or message' });
  }

  // ── 3) جلب المشتركين (بنفس توكن الأدمن، محترم صلاحيات RLS) ──
  let subscribers = [];
  try {
    const subsRes = await fetch(`${SUPABASE_URL}/rest/v1/subscribers?select=email`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${token}` }
    });
    if (!subsRes.ok) throw new Error(await subsRes.text());
    subscribers = await subsRes.json();
  } catch (e) {
    console.error('Failed to fetch subscribers:', e);
    return res.status(500).json({ error: 'Failed to fetch subscribers' });
  }

  if (!subscribers.length) {
    return res.status(200).json({ success: true, sent: 0, failed: 0, total: 0 });
  }

  // ── 4) إرسال الرسالة لكل مشترك عن طريق Resend (بالتوازي) ──
  const escapedMessage = escapeHTML(message.trim()).replace(/\n/g, '<br>');
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
      <h2 style="letter-spacing: 0.2em; font-size: 1.2rem;">MONO</h2>
      <div style="line-height: 1.7; color: #333; margin-top: 24px;">${escapedMessage}</div>
      <hr style="margin: 32px 0; border: none; border-top: 1px solid #eee;"/>
      <p style="font-size: 0.7rem; color: #999;">You're receiving this because you subscribed to MONO updates.</p>
    </div>
  `;

  const results = await Promise.allSettled(
    subscribers.filter(s => s.email).map(sub => fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_KEY}`
      },
      body: JSON.stringify({
        from: 'MONO <onboarding@resend.dev>',
        to: sub.email,
        subject,
        html
      })
    }))
  );

  const sent = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
  const failed = results.length - sent;

  results.forEach((r, i) => {
    if (r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)) {
      console.error(`Failed to send to ${subscribers[i]?.email}:`, r.reason || r.value?.status);
    }
  });

  return res.status(200).json({ success: true, sent, failed, total: subscribers.length });
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
