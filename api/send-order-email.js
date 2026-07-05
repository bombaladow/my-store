export default async function handler(req, res) {
  // ── إعدادات الـ CORS والأمان ──
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  // طباعة البيانات في الـ Logs لمراقبة الطلبات من الـ Dashboard
  console.log('Received body:', JSON.stringify(req.body));

  try {
    const { name, email, phone, address, items, total, user_id } = req.body;
    const orderEmail = String(email || '').trim() || null;

    // 1. التحقق من اكتمال البيانات الأساسية
    if (!name || !phone || !address || !items || !total) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // 2. معالجة الـ items وتحويلها لـ Array بشكل آمن لمنع كراش السيرفر
    let itemsArray = [];
    if (typeof items === 'string') {
      try {
        itemsArray = JSON.parse(items);
      } catch (e) {
        console.error("Failed to parse items string:", e);
        itemsArray = [];
      }
    } else if (Array.isArray(items)) {
      itemsArray = items;
    }

    // 3. إنشاء رقم أوردر فريد يحمل هوية البراند
    const orderNumber = 'MN-' + Date.now().toString().slice(-6);

    // 4. تجهيز الـ items كـ نص JSON موحد ومضمون لقاعدة البيانات
    const dbItems = JSON.stringify(itemsArray);

    // ── حفظ الطلب في Supabase ──
    const supaRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        order_number: orderNumber,
        name,
        email: orderEmail,
        phone,
        address,
        items: dbItems,
        total: Number(total),
        user_id: user_id || null
      })
    });

    if (!supaRes.ok) {
      const errText = await supaRes.text();
      console.error('Supabase insert failed:', errText);
      return res.status(500).json({ error: 'Database error', details: errText });
    }

    // ── إرسال إيميل التفعيل للعميل (معزول لحماية تدفق الطلب) ──
    if (orderEmail && process.env.RESEND_KEY) {
      try {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.RESEND_KEY}`
          },
          body: JSON.stringify({
            from: 'MONO <onboarding@resend.dev>',
            to: orderEmail,
            subject: `Order Confirmed — ${orderNumber}`,
            html: orderTemplate({ orderNumber, name, email: orderEmail, items: itemsArray, total, address, phone })
          })
        });
        if (!emailRes.ok) {
          console.error('Customer email failed:', await emailRes.text());
        }
      } catch (emailError) {
        console.error('Customer email exception:', emailError.message);
      }
    }

    // ── إشعار فوري لك على إيميلك الشخصي ──
    if (process.env.RESEND_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.RESEND_KEY}`
          },
          body: JSON.stringify({
            from: 'MONO <onboarding@resend.dev>',
            to: 'bombaladow@gmail.com',
            subject: `🛍️ New Order — ${orderNumber}`,
            html: `
              <div style="font-family:Arial,sans-serif; padding:24px; border:1px solid #e8e8e5; max-width:500px;">
                <h2 style="margin-bottom:20px; color:#0a0a0a;">New Order Received</h2>
                <p style="font-size:14px; margin: 8px 0;"><b>Order Number:</b> ${orderNumber}</p>
                <p style="font-size:14px; margin: 8px 0;"><b>Customer Name:</b> ${name}</p>
                <p style="font-size:14px; margin: 8px 0;"><b>Phone:</b> ${phone}</p>
                <p style="font-size:14px; margin: 8px 0;"><b>Address:</b> ${address}</p>
                <p style="font-size:16px; margin: 16px 0 0 0; color:#0a0a0a;"><b>Total Price:</b> EGP ${total}</p>
              </div>`
          })
        });
      } catch (notifyError) {
        console.error('Owner notification exception:', notifyError.message);
      }
    }

    // إرجاع رد النجاح للـ Frontend
    return res.status(200).json({ success: true, orderNumber });

  } catch (error) {
    console.error('Order handler crashed:', error.message);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
}

// ── قالب البريد الإلكتروني الأنيق للعميل ──
function orderTemplate({ orderNumber, name, email, items, total, address, phone }) {
  const itemsArray = Array.isArray(items) ? items : [];

  const itemsHTML = itemsArray.map(i => {
    if (!i) return '';

    // حساب سعر المنتج: يعتمد على سعر الخصم لو متاح وأقل من السعر الأصلي
    const itemPrice = i.sale_price && Number(i.sale_price) < Number(i.price)
      ? Number(i.sale_price)
      : (Number(i.price) || 0);

    const itemQty = Number(i.qty) || 1;

    return `
    <tr>
      <td style="padding:12px 0; border-bottom:1px solid #e8e8e5; font-family:Arial,sans-serif; font-size:.78rem; color:#333">
        ${i.name || 'Product'} — ${i.sub || ''}
      </td>
      <td style="padding:12px 0; border-bottom:1px solid #e8e8e5; font-family:Arial,sans-serif; font-size:.78rem; color:#333; text-align:center">
        ${i.size || 'Free Size'}
      </td>
      <td style="padding:12px 0; border-bottom:1px solid #e8e8e5; font-family:Arial,sans-serif; font-size:.78rem; color:#333; text-align:right">
        EGP ${itemPrice * itemQty}
      </td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
  *{margin:0; padding:0; box-sizing:border-box}
  body{background:#f9f9f7; font-family:Georgia,serif}
  .wrap{max-width:580px; margin:0 auto; padding:64px 48px}
  .logo{font-size:2rem; letter-spacing:.35em; color:#0a0a0a; display:block; margin-bottom:48px}
  h1{font-size:1.8rem; font-weight:400; color:#0a0a0a; margin-bottom:8px}
  h1 em{font-style:italic}
  .order-num{font-family:Arial,sans-serif; font-size:.65rem; letter-spacing:.15em; color:#888; margin-bottom:40px}
  .section-label{font-family:Arial,sans-serif; font-size:.6rem; letter-spacing:.15em; text-transform:uppercase; color:#888; margin-bottom:12px}
  table{width:100%; border-collapse:collapse; margin-bottom:32px}
  th{font-family:Arial,sans-serif; font-size:.6rem; letter-spacing:.12em; text-transform:uppercase; color:#888; padding:0 0 12px; border-bottom:1px solid #0a0a0a; text-align:left}
  th:last-child{text-align:right}
  th:nth-child(2){text-align:center}
  .total-row{display:flex; justify-content:space-between; align-items:center; padding:16px 0; border-top:1px solid #0a0a0a}
  .total-label{font-family:Arial,sans-serif; font-size:.65rem; letter-spacing:.12em; text-transform:uppercase}
  .total-price{font-size:1.4rem; font-weight:400}
  .info-box{background:#fff; border:1px solid #e8e8e5; padding:20px 24px; margin-bottom:32px}
  .info-row{font-family:Arial,sans-serif; font-size:.75rem; color:#444; line-height:2}
  .info-row span{color:#888; font-size:.65rem; letter-spacing:.08em; text-transform:uppercase; margin-right:8px}
  .btn{display:inline-block; background:#0a0a0a; color:#f9f9f7 !important; padding:14px 36px; text-decoration:none; font-family:Arial,sans-serif; font-size:.65rem; letter-spacing:.18em; text-transform:uppercase; margin-top:8px}
  hr{border:none; border-top:1px solid #e8e8e5; margin:40px 0}
  .foot{font-family:Arial,sans-serif; font-size:.6rem; color:#bbb; letter-spacing:.06em; line-height:1.8}
</style>
</head>
<body>
<div class="wrap">
  <span class="logo">MONO</span>
  <h1>Order <em>Confirmed.</em></h1>
  <div class="order-num">Order #${orderNumber} · Thank you, ${name.split(' ')[0]}.</div>
  <div class="section-label">Your Items</div>
  <table>
    <thead><tr><th>Product</th><th>Size</th><th>Price</th></tr></thead>
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
