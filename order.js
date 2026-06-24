export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { name, email, phone, address, items, total } = req.body;
    const orderEmail = String(email || '').trim() || null;

    if (!name || !phone || !address || !items || !total) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // ── رقم أوردر فريد ──
    const orderNumber = 'MN-' + Date.now().toString().slice(-6);

    // ── حفظ في Supabase ──
    const supaRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
        'Prefer': 'return=representation' // تم تغييرها لمعاينة الخطأ بدقة لو حدث
      },
      // تأكد أن الـ items بتم تحويلها لنص JSON لو العمود في الداتابيز text، أو سبها كدة لو jsonb
      body: JSON.stringify({ 
        order_number: orderNumber, 
        name, 
        email: orderEmail, 
        phone, 
        address, 
        items: typeof items === 'string' ? items : JSON.stringify(items), 
        total: Number(total) 
      })
    });

    if (!supaRes.ok) {
      const errorText = await supaRes.text();
      console.error("Supabase Detailed Error:", errorText); // هتظهر في ترمينال الـ Vercel أو السيرفر عندك
      return res.status(500).json({ error: 'Database error', details: errorText });
    }

    // ── إيميل تأكيد الأوردر ──
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
            html: orderTemplate({ orderNumber, name, email: orderEmail, items, total, address, phone })
          })
        });
      } catch (emailErr) {
        console.error("Resend Email Error:", emailErr);
        // مش هنوقف الأوردر لو الإيميل بس هو اللي فشل
      }
    }

    return res.status(200).json({ success: true, orderNumber });

  } catch (globalError) {
    console.error("Global Order API Error:", globalError);
    return res.status(500).json({ error: 'Internal Server Error', message: globalError.message });
  }
}

function orderTemplate({ orderNumber, name, email, items, total, address, phone }) {
  const itemsHTML = items.map(i => {
    // حل مشكلة السعر: لو المنتج جاي معاه sale_price استخدمه، غير كده استخدم السعر العادي
    const currentPrice = i.sale_price && Number(i.sale_price) < Number(i.price) ? i.sale_price : i.price;
    
    return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #e8e8e5;font-family:Arial,sans-serif;font-size:.78rem;color:#333">
        ${i.name} — ${i.sub || ''}
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #e8e8e5;font-family:Arial,sans-serif;font-size:.78rem;color:#333;text-align:center">
        ${i.size || 'Free Size'}
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #e8e8e5;font-family:Arial,sans-serif;font-size:.78rem;color:#333;text-align:right">
        EGP ${currentPrice * (i.qty || 1)}
      </td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#f9f9f7;font-family:Georgia,serif}
  .wrap{max-width:580px;margin:0 auto;padding:64px 48px}
  .logo{font-size:2rem;letter-spacing:.35em;color:#0a0a0a;display:block;margin-bottom:48px}
  h1{font-size:1.8rem;font-weight:400;color:#0a0a0a;margin-bottom:8px}
  h1 em{font-style:italic}
  .order-num{font-family:Arial,sans-serif;font-size:.65rem;letter-spacing:.15em;color:#888;margin-bottom:40px}
  .section-label{font-family:Arial,sans-serif;font-size:.6rem;letter-spacing:.15em;text-transform:uppercase;color:#888;margin-bottom:12px}
  table{width:100%;border-collapse:collapse;margin-bottom:32px}
  th{font-family:Arial,sans-serif;font-size:.6rem;letter-spacing:.12em;text-transform:uppercase;color:#888;padding:0 0 12px;border-bottom:1px solid #0a0a0a;text-align:left}
  th:last-child{text-align:right}
  th:nth-child(2){text-align:center}
  .total-row{display:flex;justify-content:space-between;align-items:center;padding:16px 0;border-top:1px solid #0a0a0a}
  .total-label{font-family:Arial,sans-serif;font-size:.65rem;letter-spacing:.12em;text-transform:uppercase}
  .total-price{font-size:1.4rem;font-weight:400}
  .info-box{background:#fff;border:1px solid #e8e8e5;padding:20px 24px;margin-bottom:32px}
  .info-row{font-family:Arial,sans-serif;font-size:.75rem;color:#444;line-height:2}
  .info-row span{color:#888;font-size:.65rem;letter-spacing:.08em;text-transform:uppercase;margin-right:8px}
  .tracking{background:#0a0a0a;padding:24px;margin-bottom:32px}
  .tracking-title{font-family:Arial,sans-serif;font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;color:#888;margin-bottom:16px}
  .track-steps{display:flex;gap:0;align-items:center}
  .track-step{flex:1;text-align:center}
  .track-dot{width:8px;height:8px;border-radius:50%;background:#f9f9f7;margin:0 auto 6px}
  .track-dot.done{background:#f9f9f7}
  .track-dot.pending{background:#444}
  .track-name{font-family:Arial,sans-serif;font-size:.5rem;letter-spacing:.1em;text-transform:uppercase;color:#f9f9f7}
  .track-name.pending{color:#555}
  .track-line{flex:1;height:1px;background:#333}
  .track-line.done{background:#f9f9f7}
  .btn{display:inline-block;background:#0a0a0a;color:#f9f9f7 !important;padding:14px 36px;
       text-decoration:none;font-family:Arial,sans-serif;font-size:.65rem;
       letter-spacing:.18em;text-transform:uppercase;margin-top:8px}
  hr{border:none;border-top:1px solid #e8e8e5;margin:40px 0}
  .foot{font-family:Arial,sans-serif;font-size:.6rem;color:#bbb;letter-spacing:.06em;line-height:1.8}
</style>
</head>
<body>
<div class="wrap">
  <span class="logo">MONO</span>

  <div class="tracking">
    <div class="tracking-title">Order Status</div>
    <div class="track-steps">
      <div class="track-step">
        <div class="track-dot done"></div>
        <div class="track-name">Confirmed</div>
      </div>
      <div class="track-line done"></div>
      <div class="track-step">
        <div class="track-dot pending"></div>
        <div class="track-name pending">Processing</div>
      </div>
      <div class="track-line"></div>
      <div class="track-step">
        <div class="track-dot pending"></div>
        <div class="track-name pending">Shipped</div>
      </div>
      <div class="track-line"></div>
      <div class="track-step">
        <div class="track-dot pending"></div>
        <div class="track-name pending">Delivered</div>
      </div>
    </div>
  </div>

  <h1>Order <em>Confirmed.</em></h1>
  <div class="order-num">Order #${orderNumber} · Thank you, ${name.split(' ')[0]}.</div>

  <div class="section-label">Your Items</div>
  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th>Size</th>
        <th>Price</th>
      </tr>
    </thead>
    <tbody>${itemsHTML}</tbody>
  </table>
  <div class="total-row">
    <span class="total-label">Total</span>
    <span class="total-price">EGP ${total}</span>
  </div>

  <br/>
  <div class="section-label">Delivery Details</div>
  <div class="info-box">
    <div class="info-row"><span>Name</span>${name}</div>
    <div class="info-row"><span>Address</span>${address}</div>
    <div class="info-row"><span>Phone</span>${phone}</div>
    <div class="info-row"><span>Email</span>${email}</div>
  </div>

  <a href="https://my-store-five-gamma.vercel.app" class="btn">Continue Shopping →</a>

  <hr/>
  <p class="foot">© 2026 MONO &nbsp;·&nbsp; You'll receive an update when your order ships.<br>Questions? Reply to this email.</p>
</div>
</body>
</html>`;
}