'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

type Product = {
  id: number;
  name: string;
  sub: string;
  price: number;
  img: string;
  badge?: string;
};

type CartItem = Product & {
  size: string;
  qty: number;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zxvzpwdueqbgwetylmng.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_3Hlrrp_fF7OHqTS3gvoGpA_vdqivpYV'
);

const products: Product[] = [
  { id: 1, name: 'Classic White Tee', sub: 'Relaxed Fit', price: 45, img: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900&q=80', badge: 'Bestseller' },
  { id: 2, name: 'Oversized Black Tee', sub: 'Boxy Fit', price: 48, img: 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=900&q=80' },
  { id: 3, name: 'Slim White Tee', sub: 'Slim Fit', price: 42, img: 'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=900&q=80', badge: 'New' },
  { id: 4, name: 'Vintage Black Tee', sub: 'Relaxed Fit', price: 50, img: 'https://images.unsplash.com/photo-1583744946564-b52ac1c389c8?w=900&q=80' },
  { id: 5, name: 'Essential White Tee', sub: 'Regular Fit', price: 40, img: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=900&q=80' },
  { id: 6, name: 'Premium Black Tee', sub: 'Slim Fit', price: 55, img: 'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=900&q=80', badge: 'Limited' },
];

const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notice, setNotice] = useState('');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [checkoutForm, setCheckoutForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [cartLoaded, setCartLoaded] = useState(false);

  const cartCount = cart.reduce((total, item) => total + item.qty, 0);
  const cartTotal = cart.reduce((total, item) => total + item.price * item.qty, 0);

  useEffect(() => {
    window.setTimeout(() => {
      const savedCart = window.localStorage.getItem('mono-cart');
      if (savedCart) setCart(JSON.parse(savedCart));
      setCartLoaded(true);
    }, 0);

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

  useEffect(() => {
    if (!cartLoaded) return;
    window.localStorage.setItem('mono-cart', JSON.stringify(cart));
  }, [cart, cartLoaded]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 2500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const userLabel = useMemo(() => {
    if (loading) return 'Loading';
    if (!user) return 'Sign In';
    return user.user_metadata?.full_name?.split(' ')[0] || user.email || 'Account';
  }, [loading, user]);

  const handleAuth = async () => {
    if (user) {
      await supabase.auth.signOut();
      setNotice('Signed out');
      return;
    }
    setAuthOpen(true);
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) setNotice('Google sign in failed');
  };

  const openProduct = (product: Product) => {
    setSelectedProduct(product);
    setSelectedSize('');
  };

  const confirmAdd = () => {
    if (!selectedProduct) return;
    if (!selectedSize) {
      setNotice('Please select a size');
      return;
    }

    setCart((current) => {
      const existing = current.find((item) => item.id === selectedProduct.id && item.size === selectedSize);
      if (existing) {
        return current.map((item) =>
          item.id === selectedProduct.id && item.size === selectedSize ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...current, { ...selectedProduct, size: selectedSize, qty: 1 }];
    });

    setNotice(`${selectedProduct.name} - ${selectedSize} added`);
    setSelectedProduct(null);
  };

  const removeFromCart = (id: number, size: string) => {
    setCart((current) => current.filter((item) => !(item.id === id && item.size === size)));
  };

  const beginCheckout = () => {
    if (!cart.length) {
      setNotice('Your bag is empty');
      return;
    }
    setCartOpen(false);
    setCheckoutOpen(true);
    setCheckoutForm((current) => ({
      ...current,
      name: current.name || user?.user_metadata?.full_name || '',
      email: current.email || user?.email || '',
    }));
  };

  const submitOrder = async () => {
    if (!checkoutForm.name || !checkoutForm.email || !checkoutForm.phone || !checkoutForm.address) {
      setNotice('Please fill in all fields');
      return;
    }

    setSubmittingOrder(true);
    try {
      const response = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...checkoutForm,
          items: cart,
          total: cartTotal,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Order failed');

      setCart([]);
      setCheckoutOpen(false);
      setCheckoutForm({ name: '', email: user?.email || '', phone: '', address: '' });
      setNotice(`Order ${data.orderNumber} confirmed`);
    } catch (error) {
      console.error(error);
      setNotice(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const subscribeNewsletter = async () => {
    if (!newsletterEmail.includes('@')) {
      setNotice('Please enter a valid email');
      return;
    }

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newsletterEmail }),
      });
      const data = await response.json();
      if (data.success) {
        setNewsletterEmail('');
        setNotice('Welcome to MONO');
      } else if (data.message === 'already_subscribed') {
        setNotice('Already subscribed');
      } else {
        setNotice('Something went wrong');
      }
    } catch (error) {
      console.error(error);
      setNotice('Something went wrong');
    }
  };

  return (
    <main className="mono-page">
      <header className="site-header">
        <a className="logo" href="#">MONO</a>
        <button className={`hamburger ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen((open) => !open)} aria-label="Menu">
          <span />
          <span />
          <span />
        </button>
        <nav className={menuOpen ? 'open' : ''}>
          <a href="#products" onClick={() => setMenuOpen(false)}>Shop</a>
          <a href="#about" onClick={() => setMenuOpen(false)}>About</a>
          <a href="#newsletter" onClick={() => setMenuOpen(false)}>Newsletter</a>
          <button className="nav-btn" onClick={handleAuth}>{userLabel}</button>
          <button className="nav-btn" onClick={() => setCartOpen(true)}>
            Bag <span className={`cart-count ${cartCount ? 'show' : ''}`}>{cartCount}</span>
          </button>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-left">
          <div className="hero-tag">SS 2026 - Pure Cotton</div>
          <h1 className="hero-title">Less is<br /><em>everything.</em></h1>
          <a href="#products" className="hero-cta">Shop the Collection</a>
        </div>
        <div className="hero-right">
          <div className="hero-right-inner">
            <div className="hero-thumb">
              <Image src="https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=700&q=80" alt="MONO white tee" fill sizes="(max-width: 768px) 50vw, 25vw" />
            </div>
            <div className="hero-thumb">
              <Image src="https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=700&q=80" alt="MONO black tee" fill sizes="(max-width: 768px) 50vw, 25vw" />
            </div>
          </div>
        </div>
      </section>

      <div className="marquee-wrap">
        <div className="marquee-track">
          {Array.from({ length: 2 }).map((_, index) => (
            <span key={index}>100% Egyptian Cotton <b>·</b> Minimal Design <b>·</b> Made to Last <b>·</b> Black & White Essentials <b>·</b> SS 2026 <b>·</b></span>
          ))}
        </div>
      </div>

      <section id="products">
        <div className="section-header">
          <h2 className="section-title">The <em>Collection</em></h2>
          <span className="section-sub">6 Pieces - SS 2026</span>
        </div>
        <div className="products-grid">
          {products.map((product) => (
            <article className="product-card" key={product.id}>
              <div className="product-img-wrap">
                <Image src={product.img} alt={product.name} fill sizes="(max-width: 768px) 100vw, 33vw" />
                <div className="product-overlay">
                  <button className="quick-add" onClick={() => openProduct(product)}>Quick Add</button>
                </div>
              </div>
              {product.badge && <div className="product-badge">{product.badge}</div>}
              <div className="product-info">
                <div>
                  <div className="product-name">{product.name}</div>
                  <div className="product-sub">{product.sub}</div>
                </div>
                <div className="product-price">${product.price}</div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="feature-strip">
        <div className="feature-item"><div className="feature-icon">○</div><div className="feature-title">Pure Cotton</div><div className="feature-desc">100% Egyptian combed cotton. Breathable, durable, and gets better with every wash.</div></div>
        <div className="feature-item"><div className="feature-icon">◆</div><div className="feature-title">Free Returns</div><div className="feature-desc">Not in love? Return within 30 days, no questions asked.</div></div>
        <div className="feature-item"><div className="feature-icon">◎</div><div className="feature-title">Worldwide Shipping</div><div className="feature-desc">Free shipping on orders over $80. Delivered in 3-5 business days.</div></div>
      </div>

      <section className="editorial" id="about">
        <div className="editorial-img">
          <Image src="https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=1200&q=80" alt="MONO cotton essentials" fill sizes="(max-width: 768px) 100vw, 50vw" />
        </div>
        <div className="editorial-content">
          <div className="editorial-label">Our Philosophy</div>
          <h2 className="editorial-title">Designed for<br /><em>everyday</em><br />living.</h2>
          <p className="editorial-text">MONO was born from a simple obsession: the perfect white tee and the perfect black tee. We source fine cotton and cut every piece to live in your wardrobe for years, not seasons.</p>
          <a href="#products" className="btn-outline">Shop Now</a>
        </div>
      </section>

      <section className="newsletter" id="newsletter">
        <h2 className="newsletter-title">Stay in the <em>loop.</em></h2>
        <p className="newsletter-sub">New drops, restocks, and rare offers straight to your inbox.</p>
        <div className="newsletter-form">
          <input className="newsletter-input" type="email" placeholder="your@email.com" value={newsletterEmail} onChange={(event) => setNewsletterEmail(event.target.value)} />
          <button className="newsletter-submit" onClick={subscribeNewsletter}>Subscribe</button>
        </div>
      </section>

      <footer>
        <div className="footer-brand"><a href="#" className="logo-dark">MONO</a><p>Pure cotton essentials. Black & white, nothing more.</p></div>
        <div className="footer-col"><h4>Shop</h4><a href="#products">White Tees</a><a href="#products">Black Tees</a><a href="#products">New Arrivals</a></div>
        <div className="footer-col"><h4>Help</h4><a href="#">Sizing Guide</a><a href="#">Shipping</a><a href="#">Returns</a></div>
        <div className="footer-col"><h4>Follow</h4><a href="#">Instagram</a><a href="#">Pinterest</a><a href="#">TikTok</a></div>
      </footer>
      <div className="footer-bottom"><p>© 2026 MONO. All rights reserved.</p><p>Crafted with intention.</p></div>

      <div className={`cart-overlay ${cartOpen ? 'open' : ''}`} onClick={() => setCartOpen(false)} />
      <aside className={`cart-sidebar ${cartOpen ? 'open' : ''}`}>
        <div className="cart-head">
          <div className="cart-head-title">Your Bag</div>
          <button className="close-btn" onClick={() => setCartOpen(false)}>×</button>
        </div>
        <div className="cart-items">
          {!cart.length ? (
            <div className="cart-empty"><div className="cart-empty-icon">◇</div><p>Your bag is empty</p></div>
          ) : cart.map((item) => (
            <div className="cart-item" key={`${item.id}-${item.size}`}>
              <Image className="cart-item-img" src={item.img} alt={item.name} width={80} height={100} />
              <div><div className="cart-item-name">{item.name}</div><div className="cart-item-size">Size: {item.size} · Qty: {item.qty}</div></div>
              <div className="cart-item-actions">
                <span className="cart-item-price">${item.price * item.qty}</span>
                <button className="remove-item" onClick={() => removeFromCart(item.id, item.size)}>×</button>
              </div>
            </div>
          ))}
        </div>
        <div className="cart-foot">
          <div className="cart-total"><span className="cart-total-label">Total</span><span className="cart-total-price">${cartTotal}</span></div>
          <button className="checkout-btn" onClick={beginCheckout}>Checkout</button>
        </div>
      </aside>

      {selectedProduct && (
        <div className="modal-overlay open">
          <div className="modal">
            <button className="modal-close" onClick={() => setSelectedProduct(null)}>×</button>
            <div className="modal-title">{selectedProduct.name}</div>
            <div className="modal-sub">${selectedProduct.price}</div>
            <div className="modal-label">Select Size</div>
            <div className="size-grid">
              {sizes.map((size) => <button key={size} className={`size-btn ${selectedSize === size ? 'selected' : ''}`} onClick={() => setSelectedSize(size)}>{size}</button>)}
            </div>
            <button className="modal-btn" onClick={confirmAdd}>Add to Bag</button>
          </div>
        </div>
      )}

      {authOpen && (
        <div className="modal-overlay open">
          <div className="modal">
            <button className="modal-close" onClick={() => setAuthOpen(false)}>×</button>
            <div className="modal-title">Welcome to MONO</div>
            <div className="modal-sub">Sign in to shop and track your orders.</div>
            <button className="google-btn" onClick={signInWithGoogle}>Continue with Google</button>
            <div className="divider">or continue as guest</div>
            <button className="modal-btn outline" onClick={() => setAuthOpen(false)}>Guest Checkout</button>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <div className="modal-overlay open">
          <div className="modal wide">
            <button className="modal-close" onClick={() => setCheckoutOpen(false)}>×</button>
            <div className="modal-title">Complete Your Order</div>
            <div className="modal-sub">{cartCount} item{cartCount === 1 ? '' : 's'} · ${cartTotal}</div>
            <div className="modal-label">Full Name</div>
            <input className="modal-input" value={checkoutForm.name} onChange={(event) => setCheckoutForm({ ...checkoutForm, name: event.target.value })} placeholder="Ahmed Mohamed Ali" />
            <div className="modal-label">Email</div>
            <input className="modal-input" type="email" value={checkoutForm.email} onChange={(event) => setCheckoutForm({ ...checkoutForm, email: event.target.value })} placeholder="ahmed@email.com" />
            <div className="modal-label">Phone Number</div>
            <input className="modal-input" value={checkoutForm.phone} onChange={(event) => setCheckoutForm({ ...checkoutForm, phone: event.target.value })} placeholder="+20 1XX XXX XXXX" />
            <div className="modal-label">Delivery Address</div>
            <input className="modal-input" value={checkoutForm.address} onChange={(event) => setCheckoutForm({ ...checkoutForm, address: event.target.value })} placeholder="Street, City, Country" />
            <button className="modal-btn" disabled={submittingOrder} onClick={submitOrder}>{submittingOrder ? 'Placing order...' : 'Place Order'}</button>
          </div>
        </div>
      )}

      <div className={`notif ${notice ? 'show' : ''}`}>{notice}</div>
    </main>
  );
}
