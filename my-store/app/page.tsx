'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// الربط المباشر مع Supabase
const supabase = createClient(
  'https://zxvzpwdueqbgwetylmng.supabase.co',
  'sb_publishable_3Hlrrp_fF7OHqTS3gvoGpA_vdqivpYV' // ⚠️ حط الـ Publishable key هنا
);

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : '',
        },
      });
      if (error) throw error;
    } catch (error) {
      alert('Error connecting to Google');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // 🚀 الدالة الاحترافية لإرسال الأوردر للداتابيز
  const handleCheckout = async () => {
    if (!user) {
      alert('Please Sign In with Google first to place an order.');
      return;
    }

    const { data, error } = await supabase
      .from('orders')
      .insert([
        {
          user_id: user.id,
          customer_name: user.user_metadata?.full_name || 'Guest',
          customer_email: user.email,
          items_count: cartCount,
          total_price: cartCount * 450, // حسبة سريعة للتجربة
        }
      ]);

    if (error) {
      console.error(error);
      alert('❌ Error placing order. Try again.');
    } else {
      alert('✅ Order Placed Successfully! (Check Supabase Database)');
      setCartCount(0); // تصفير الشنطة بعد الأوردر
    }
  };

  return (
    <div className="min-h-screen bg-white text-black antialiased font-sans flex flex-col justify-between">
      {/* Navbar */}
      <nav className="fixed top-0 w-full flex justify-between items-center px-10 py-6 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <a href="#" className="font-medium text-xl tracking-wider">MONO</a>
        
        <div className="flex items-center gap-6 text-sm font-light">
          <div className="flex items-center gap-3">
            <span>Bag ({cartCount})</span>
            {/* زرار الدفع هيظهر بس لو الشنطة فيها منتجات */}
            {cartCount > 0 && (
              <button onClick={handleCheckout} className="bg-black text-white px-3 py-1.5 text-xs uppercase tracking-wider rounded hover:opacity-80 transition">
                Checkout
              </button>
            )}
          </div>
          
          {loading ? (
            <div className="text-gray-400">Loading...</div>
          ) : user ? (
            <div className="flex items-center gap-3">
              {user.user_metadata?.avatar_url && (
                <img 
                  src={user.user_metadata.avatar_url} 
                  alt="profile" 
                  className="w-7 h-7 rounded-full border border-gray-200"
                />
              )}
              <span className="font-normal text-gray-700 hidden md:block">{user.user_metadata?.full_name || user.email}</span>
              <button onClick={handleLogout} className="underline text-gray-400 hover:text-black ml-2">Logout</button>
            </div>
          ) : (
            <button 
              onClick={handleGoogleLogin} 
              className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded text-xs uppercase tracking-wider hover:opacity-80 transition"
            >
              Sign In
            </button>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <div className="flex flex-col justify-center items-center text-center px-4 pt-48 pb-12">
        <h1 className="text-4xl md:text-6xl font-normal tracking-widest mb-4">MONO ESSENTIALS</h1>
        <p className="text-xs md:text-sm text-gray-500 max-w-md leading-relaxed tracking-wide">
          Premium streetwear crafted with meticulous attention to detail, form, and lasting comfort.
        </p>
      </div>

      {/* Products */}
      <div className="max-w-5xl mx-auto px-6 pb-32 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="flex flex-col">
            <div className="w-full aspect-square bg-gray-50 rounded mb-4 flex items-center justify-center text-gray-400 font-light border border-gray-100">
              Heavyweight Tee
            </div>
            <div className="flex justify-between text-sm px-1">
              <span className="font-normal">Basic Heavyweight Tee</span>
              <span className="text-gray-500">390 LE</span>
            </div>
            <button onClick={() => setCartCount(prev => prev + 1)} className="mt-4 bg-black text-white py-3 text-xs uppercase tracking-widest rounded hover:opacity-90 transition">
              Add to Bag
            </button>
          </div>

          <div className="flex flex-col">
            <div className="w-full aspect-square bg-gray-50 rounded mb-4 flex items-center justify-center text-gray-400 font-light border border-gray-100">
              Boxy Shirt
            </div>
            <div className="flex justify-between text-sm px-1">
              <span className="font-normal">Oversized Boxy Shirt</span>
              <span className="text-gray-500">450 LE</span>
            </div>
            <button onClick={() => setCartCount(prev => prev + 1)} className="mt-4 bg-black text-white py-3 text-xs uppercase tracking-widest rounded hover:opacity-90 transition">
              Add to Bag
            </button>
          </div>
        </div>
      </div>

      <footer className="border-t border-gray-100 py-8 text-center text-xs text-gray-400 tracking-wider w-full">
        © 2026 MONO ESSENTIALS. ALL RIGHTS RESERVED.
      </footer>
    </div>
  );
}