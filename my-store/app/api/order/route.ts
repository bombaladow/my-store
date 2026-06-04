import { appendFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type OrderItem = {
  name: string;
  sub?: string;
  size: string;
  qty: number;
  price: number;
};

export async function POST(request: Request) {
  const { name, email, phone, address, items, total } = await request.json();

  if (!name || !email || !phone || !address || !Array.isArray(items) || !items.length || !total) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const orderNumber = `MN-${Date.now().toString().slice(-6)}`;
  const orderRecord = {
    order_number: orderNumber,
    name,
    email,
    phone,
    address,
    items,
    total,
    created_at: new Date().toISOString(),
  };

  try {
    await saveOrderLocally(orderRecord);
    void syncOrderBestEffort(orderRecord);
    sendConfirmationEmail({ orderNumber, name, email, items, total, address, phone });

    return NextResponse.json({ success: true, orderNumber, source: 'local' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not save order right now.' }, { status: 500 });
  }
}

async function saveOrderLocally(order: Record<string, unknown>) {
  const dataDir = path.join(os.tmpdir(), 'mono-store-data');
  const filePath = path.join(dataDir, 'orders.ndjson');

  await mkdir(dataDir, { recursive: true });
  await appendFile(filePath, `${JSON.stringify(order)}\n`, 'utf8');
}

async function syncOrderBestEffort(order: Record<string, unknown>) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) return;

  try {
    await fetchWithTimeout(`${process.env.SUPABASE_URL}/rest/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.SUPABASE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(order),
    }, 2500);
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      console.error(error);
    }
  }
}

function sendConfirmationEmail({
  orderNumber,
  name,
  email,
  items,
  total,
  address,
  phone,
}: {
  orderNumber: string;
  name: string;
  email: string;
  items: OrderItem[];
  total: number;
  address: string;
  phone: string;
}) {
  if (!process.env.RESEND_KEY) return;

  fetchWithTimeout('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_KEY}`,
    },
    body: JSON.stringify({
      from: 'MONO <onboarding@resend.dev>',
      to: email,
      subject: `Order Confirmed - ${orderNumber}`,
      html: orderTemplate({ orderNumber, name, email, items, total, address, phone }),
    }),
  }, 6000).catch((error) => {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      console.error(error);
    }
  });
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function orderTemplate({
  orderNumber,
  name,
  email,
  items,
  total,
  address,
  phone,
}: {
  orderNumber: string;
  name: string;
  email: string;
  items: OrderItem[];
  total: number;
  address: string;
  phone: string;
}) {
  const itemsHTML = items.map((item) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #e8e8e5">${escapeHtml(item.name)} - ${escapeHtml(item.sub || '')}</td>
      <td style="padding:12px 0;border-bottom:1px solid #e8e8e5;text-align:center">${escapeHtml(item.size)} x ${item.qty}</td>
      <td style="padding:12px 0;border-bottom:1px solid #e8e8e5;text-align:right">$${item.price * item.qty}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;background:#f9f9f7;color:#0a0a0a;font-family:Arial,sans-serif">
  <div style="max-width:580px;margin:0 auto;padding:56px 36px">
    <div style="font-size:30px;letter-spacing:.35em;margin-bottom:36px">MONO</div>
    <h1 style="font-weight:400;margin:0 0 8px">Order Confirmed.</h1>
    <p style="color:#888;letter-spacing:.12em;text-transform:uppercase;font-size:12px">Order #${orderNumber}</p>
    <table style="width:100%;border-collapse:collapse;margin:32px 0">${itemsHTML}</table>
    <div style="display:flex;justify-content:space-between;border-top:1px solid #0a0a0a;padding-top:16px">
      <span>Total</span><strong>$${total}</strong>
    </div>
    <div style="margin-top:32px;padding:20px;border:1px solid #e8e8e5;background:#fff">
      <p>Name: ${escapeHtml(name)}</p>
      <p>Email: ${escapeHtml(email)}</p>
      <p>Phone: ${escapeHtml(phone)}</p>
      <p>Address: ${escapeHtml(address)}</p>
    </div>
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
