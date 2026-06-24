export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { name, email, phone, address, items, total } = req.body;
    const orderEmail = String(email || '').trim() || null;

    // تشخيص مبدئي للداتا اللي جاية من الفرونت
    if (!name || !phone || !address || !items || !total) {
      return res.status(400).json({ error: 'Missing fields', received: { name, phone, address, hasItems: !!items, total } });
    }

    const orderNumber = 'MN-' + Date.now().toString().slice(-6);

    // تجهيز الداتا لـ Supabase بشكل آمن تماماً
    const finalItems = typeof items === 'string' ? items : JSON.stringify(items);
    const finalTotal = Number(total) || 0;

    // تأكد من وجود المتغيرات البيئية
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      return res.status(500).json({ error: 'Server configuration error: Missing Supabase keys on Vercel' });
    }

    // ── حفظ في Supabase ──
    const supaRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
      },
      body: JSON.stringify({ 
        order_number: orderNumber, 
        name, 
        email: orderEmail, 
        phone, 
        address, 
        items: finalItems, 
        total: finalTotal 
      })
    });

    if (!supaRes.ok) {
      const errorText = await supaRes.text();
      return res.status(500).json({ error: 'Database error', details: errorText });
    }

    // ── إيميل تأكيد الأوردر (محاط بـ try/catch معزول تماماً عشان لو فشل ميبوظش الأوردر) ──
    if (orderEmail && process.env.RESEND_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.RESEND_KEY}`
          },
          body: JSON.stringify({
            from: 'MONO <onboarding@resend.dev>',
            to: orderEmail,
            subject: `Order Confirmed — ${orderNumber}`,
            html: orderTemplate({ orderNumber, name, email: orderEmail, items, total: finalTotal, address, phone })
          })
        });
      } catch (emailErr) {
        console.error("Email layout crash bypassed:", emailErr);
      }
    }

    return res.status(200).json({ success: true, orderNumber });

  } catch (globalError) {
    return res.status(500).json({ error: 'Catch block triggered', message: globalError.message });
  }
}

function orderTemplate({ orderNumber, name, email, items, total, address, phone }) {
  // عملنا Array.isArray للتأكد إن الـ items واصلة صح وميعملش كراش لو واصلة كـ stringified JSON
  const itemsArray = Array.isArray(items) ? items : [];
  
  const itemsHTML = itemsArray.map(i => {
    if (!i) return '';
    const price = Number(i.sale_price) && Number(i.sale_price) < Number(i.price) ? Number(i.sale_price) : (Number(i.price) || 0);
    const qty = Number(i.qty) || 1;
    return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #e8e8e5;font-family:Arial,sans-serif;font-size:.78rem;color:#333">
        ${i.name || 'Product'} — ${i.sub || ''}
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #e8e8e5;font-family:Arial,sans-serif;font-size:.78rem;color:#333;text-align:center">
        ${i.size || 'Free Size'}
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #e8e8e5;font-family:Arial,sans-serif;font-size:.78rem;color:#333;text-align:right">
        EGP ${price * qty}
      </td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html><body style="font-family:serif; background:#f9f9f7; padding:20px;">
    <h2>MONO</h2>
    <p>Order #${orderNumber} Confirmed for ${name}</p>
    <table style="width:100%; border-collapse:collapse;">${itemsHTML}</table>
    <p><strong>Total: EGP ${total}</strong></p>
    <p>Delivery to: ${address} (Phone: ${phone})</p>
  </body></html>`;
}