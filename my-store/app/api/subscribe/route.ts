import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { email: rawEmail } = await request.json();
  const email = String(rawEmail || '').trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    return NextResponse.json({ error: 'Missing Supabase configuration' }, { status: 500 });
  }

  try {
    const existingRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/subscribers?email=eq.${encodeURIComponent(email)}&select=email`,
      {
        headers: {
          apikey: process.env.SUPABASE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
        },
      }
    );

    if (!existingRes.ok) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const existing = await existingRes.json();
    if (existing.length > 0) {
      return NextResponse.json({ success: false, message: 'already_subscribed' });
    }

    const insertRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/subscribers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.SUPABASE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ email }),
    });

    if (!insertRes.ok) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
