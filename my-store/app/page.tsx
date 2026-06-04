'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { createClient, type User } from '@supabase/supabase-js';

type ProductTone = 'white' | 'black';

type Product = {
  id: number;
  name: string;
  fit: string;
  price: number;
  img: string;
  tone: ProductTone;
  badge?: string;
};

type CartItem = Product & {
  size: string;
  qty: number;
};

type CollectionFilter = 'all' | ProductTone;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zxvzpwdueqbgwetylmng.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_3Hlrrp_fF7OHqTS3gvoGpA_vdqivpYV'
);

const products: Product[] = [
  {
    id: 1,
    name: 'MONO White Tee 01',
    fit: 'Relaxed fit',
    price: 42,
    img: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=900&q=80',
    tone: 'white',
    badge: 'Core',
  },
  {
    id: 2,
    name: 'MONO Black Tee 01',
    fit: 'Boxy fit',
    price: 44,
    img: 'https://images.unsplash.com/photo-1523398002811-999ca8dec234?w=900&q=80',
    tone: 'black',
    badge: 'Core',
  },
  {
    id: 3,
    name: 'MONO White Tee 02',
    fit: 'Sharp regular fit',
    price: 46,
    img: 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=900&q=80',
    tone: 'white',
    badge: 'New',
  },
  {
    id: 4,
    name: 'MONO Black Tee 02',
    fit: 'Oversized fit',
    price: 48,
    img: 'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=900&q=80',
    tone: 'black',
  },
  {
    id: 5,
    name: 'MONO White Long Sleeve',
    fit: 'Clean layering piece',
    price: 52,
    img: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&q=80',
    tone: 'white',
  },
  {
    id: 6,
    name: 'MONO Black Long Sleeve',
    fit: 'Heavyweight base layer',
    price: 54,
    img: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=900&q=80',
    tone: 'black',
    badge: 'Limited',
  },
];

const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const collectionFilters: Array<{ label: string; value: CollectionFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'White', value: 'white' },
  { label: 'Black', value: 'black' },
];

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
  const [collectionFilter, setCollectionFilter] = useState<CollectionFilter>('all');

  const cartCount = cart.reduce((total, item) => total + item.qty, 0);
  const cartTotal = cart.reduce((total, item) => total + item.price * item.qty, 0);

  const visibleProducts = useMemo(
    () => products.filter((product) => collectionFilter === 'all' || product.tone === collectionFilter),
    [collectionFilter]
  );

  useEffect(() => {
    window.setTimeout(() => {
      try {
        const savedCart = window.localStorage.getItem('mono-cart');
        if (savedCart) setCart(JSON.parse(savedCart));
      } catch {
        window.localStorage.removeItem('mono-cart');
      }
      setCartLoaded(true);
    }, 0);

    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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
    if (!user) return 'Account';
    return user.user_metadata?.full_name?.split(' ')[0] || user.email || 'Account';
  }, [loading, user]);

  const handleAuth = async () => {
    setMenuOpen(false);
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

    setNotice(`${selectedProduct.name} / ${selectedSize} added`);
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
        <a className="logo" href="#">
          MONO
        </a>

        <nav className={menuOpen ? 'open' : ''}>
          <a href="#collection" onClick={() => setMenuOpen(false)}>
            Shop
          </a>
          <a href="#story" onClick={() => setMenuOpen(false)}>
            Story
          </a>
          <a href="#newsletter" onClick={() => setMenuOpen(false)}>
            Newsletter
          </a>
          <button className="nav-btn mobile-account" onClick={handleAuth}>
            {userLabel}
          </button>
        </nav>

        <div className="header-actions">
          <button className="nav-btn desktop-account" onClick={handleAuth}>
            {userLabel}
          </button>
          <button className="nav-btn bag-btn" onClick={() => setCartOpen(true)}>
            Bag <span className={`cart-count ${cartCount ? 'show' : ''}`}>{cartCount}</span>
          </button>
          <button
            className={`hamburger ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Menu"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      <section className="hero">
        <Image
          src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=1600&q=80"
          alt="MONO black and white essentials"
          fill
          priority
          sizes="100vw"
          className="hero-bg"
        />
        <div className="hero-scrim" />
        <div className="hero-content">
          <div className="hero-kicker">MONO / SS 2026 / Black and White Essentials</div>
          <h1 className="hero-title">
            The tee,
            <br />
            perfected.
          </h1>
          <p className="hero-copy">
            A tighter wardrobe starts here: white, black, and the cleanest cuts we could build around them.
          </p>
          <div className="hero-actions">
            <a href="#collection" className="hero-primary">
              Shop collection
            </a>
            <a href="#story" className="hero-secondary">
              Our story
            </a>
          </div>
          <div className="hero-pills">
            <span>Pure cotton</span>
            <span>Black / White only</span>
            <span>Fast checkout</span>
          </div>
        </div>
      </section>

      <section className="collection-shell" id="collection">
        <div className="section-head">
          <div>
            <div className="section-label">The collection</div>
            <h2 className="section-title">
              Black. White. <em>Nothing extra.</em>
            </h2>
          </div>
          <p className="section-copy">
            Start with the essentials, then build outward. Every piece is simple, wearable, and designed to sit
            together cleanly.
          </p>
        </div>

        <div className="filter-row" role="tablist" aria-label="Collection filters">
          {collectionFilters.map((filter) => (
            <button
              key={filter.value}
              className={`filter-chip ${collectionFilter === filter.value ? 'active' : ''}`}
              onClick={() => setCollectionFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="products-grid">
          {visibleProducts.map((product) => (
            <article className="product-card" key={product.id}>
              <div className="product-image">
                <Image src={product.img} alt={product.name} fill sizes="(max-width: 900px) 100vw, 33vw" />
                <button className="quick-add" onClick={() => openProduct(product)}>
                  Quick add
                </button>
                {product.badge && <span className="product-badge">{product.badge}</span>}
              </div>
              <div className="product-info">
                <div>
                  <div className="product-name">{product.name}</div>
                  <div className="product-fit">{product.fit}</div>
                </div>
                <div className="product-price">${product.price}</div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="value-strip">
        <div className="value-item">
          <div className="value-label">Fabric</div>
          <p>Soft, heavyweight cotton with a clean hand feel and an easy daily fit.</p>
        </div>
        <div className="value-item">
          <div className="value-label">Palette</div>
          <p>We begin with white and black so every drop can layer together naturally.</p>
        </div>
        <div className="value-item">
          <div className="value-label">Checkout</div>
          <p>A fast, simple flow with size selection, bag editing, and one clear order step.</p>
        </div>
      </section>

      <section className="story" id="story">
        <Image
          src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1600&q=80"
          alt="MONO editorial"
          fill
          sizes="100vw"
          className="story-bg"
        />
        <div className="story-scrim" />
        <div className="story-copy">
          <div className="section-label">Brand direction</div>
          <h2 className="section-title">
            Built like a fashion house.
            <br />
            <em>Easy</em> like an everyday tee.
          </h2>
          <p>
            MONO is meant to feel elevated without being fussy. That means quiet typography, generous space, and a
            shopping flow that gets out of the way.
          </p>
          <a href="#collection" className="hero-primary">
            Explore the edit
          </a>
        </div>
      </section>

      <section className="newsletter" id="newsletter">
        <div className="section-label">Newsletter</div>
        <h2 className="newsletter-title">New drops. Restocks. Rare offers.</h2>
        <p className="newsletter-copy">Join for MONO updates and early access to new essentials.</p>
        <div className="newsletter-form">
          <input
            className="newsletter-input"
            type="email"
            placeholder="your@email.com"
            value={newsletterEmail}
            onChange={(event) => setNewsletterEmail(event.target.value)}
          />
          <button className="newsletter-submit" onClick={subscribeNewsletter}>
            Subscribe
          </button>
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-brand">
          <a href="#" className="logo-dark">
            MONO
          </a>
          <p>Black and white essentials made for a quieter wardrobe.</p>
        </div>
        <div className="footer-col">
          <h4>Shop</h4>
          <a href="#collection">White tees</a>
          <a href="#collection">Black tees</a>
          <a href="#collection">Long sleeves</a>
        </div>
        <div className="footer-col">
          <h4>Help</h4>
          <a href="#">Sizing</a>
          <a href="#">Shipping</a>
          <a href="#">Returns</a>
        </div>
        <div className="footer-col">
          <h4>Follow</h4>
          <a href="#">Instagram</a>
          <a href="#">Pinterest</a>
          <a href="#">TikTok</a>
        </div>
      </footer>

      <div className="footer-bottom">
        <p>&copy; 2026 MONO. All rights reserved.</p>
        <p>Designed for simplicity.</p>
      </div>

      <div className={`cart-overlay ${cartOpen ? 'open' : ''}`} onClick={() => setCartOpen(false)} />
      <aside className={`cart-sidebar ${cartOpen ? 'open' : ''}`}>
        <div className="cart-head">
          <div className="cart-head-title">Your Bag</div>
          <button className="close-btn" onClick={() => setCartOpen(false)}>
            &times;
          </button>
        </div>

        <div className="cart-items">
          {!cart.length ? (
            <div className="cart-empty">
              <div className="cart-empty-icon">[]</div>
              <p>Your bag is empty</p>
            </div>
          ) : (
            cart.map((item) => (
              <div className="cart-item" key={`${item.id}-${item.size}`}>
                <Image className="cart-item-img" src={item.img} alt={item.name} width={80} height={100} />
                <div>
                  <div className="cart-item-name">{item.name}</div>
                  <div className="cart-item-size">
                    Size: {item.size} / Qty: {item.qty}
                  </div>
                </div>
                <div className="cart-item-actions">
                  <span className="cart-item-price">${item.price * item.qty}</span>
                  <button className="remove-item" onClick={() => removeFromCart(item.id, item.size)}>
                    &times;
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="cart-foot">
          <div className="cart-total">
            <span className="cart-total-label">Total</span>
            <span className="cart-total-price">${cartTotal}</span>
          </div>
          <button className="checkout-btn" onClick={beginCheckout}>
            Checkout
          </button>
        </div>
      </aside>

      {selectedProduct && (
        <div className="modal-overlay open">
          <div className="modal">
            <button className="modal-close" onClick={() => setSelectedProduct(null)}>
              &times;
            </button>
            <div className="modal-media">
              <Image src={selectedProduct.img} alt={selectedProduct.name} fill sizes="(max-width: 900px) 90vw, 420px" />
            </div>
            <div className="modal-title">{selectedProduct.name}</div>
            <div className="modal-sub">{selectedProduct.fit} / ${selectedProduct.price}</div>
            <div className="modal-label">Select size</div>
            <div className="size-grid">
              {sizes.map((size) => (
                <button
                  key={size}
                  className={`size-btn ${selectedSize === size ? 'selected' : ''}`}
                  onClick={() => setSelectedSize(size)}
                >
                  {size}
                </button>
              ))}
            </div>
            <button className="modal-btn" onClick={confirmAdd}>
              Add to bag
            </button>
          </div>
        </div>
      )}

      {authOpen && (
        <div className="modal-overlay open">
          <div className="modal">
            <button className="modal-close" onClick={() => setAuthOpen(false)}>
              &times;
            </button>
            <div className="modal-title">Welcome to MONO</div>
            <div className="modal-sub">Sign in to track orders and keep your bag synced.</div>
            <button className="google-btn" onClick={signInWithGoogle}>
              Continue with Google
            </button>
            <div className="divider">or continue as guest</div>
            <button className="modal-btn outline" onClick={() => setAuthOpen(false)}>
              Guest checkout
            </button>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <div className="modal-overlay open">
          <div className="modal wide">
            <button className="modal-close" onClick={() => setCheckoutOpen(false)}>
              &times;
            </button>
            <div className="modal-title">Complete your order</div>
            <div className="modal-sub">
              {cartCount} item{cartCount === 1 ? '' : 's'} / ${cartTotal}
            </div>
            <div className="modal-label">Full name</div>
            <input
              className="modal-input"
              value={checkoutForm.name}
              onChange={(event) => setCheckoutForm({ ...checkoutForm, name: event.target.value })}
              placeholder="Ahmed Mohamed Ali"
            />
            <div className="modal-label">Email</div>
            <input
              className="modal-input"
              type="email"
              value={checkoutForm.email}
              onChange={(event) => setCheckoutForm({ ...checkoutForm, email: event.target.value })}
              placeholder="ahmed@email.com"
            />
            <div className="modal-label">Phone number</div>
            <input
              className="modal-input"
              value={checkoutForm.phone}
              onChange={(event) => setCheckoutForm({ ...checkoutForm, phone: event.target.value })}
              placeholder="+20 1XX XXX XXXX"
            />
            <div className="modal-label">Delivery address</div>
            <input
              className="modal-input"
              value={checkoutForm.address}
              onChange={(event) => setCheckoutForm({ ...checkoutForm, address: event.target.value })}
              placeholder="Street, City, Country"
            />
            <button className="modal-btn" disabled={submittingOrder} onClick={submitOrder}>
              {submittingOrder ? 'Placing order...' : 'Place order'}
            </button>
          </div>
        </div>
      )}

      <div className={`notif ${notice ? 'show' : ''}`}>{notice}</div>
    </main>
  );
}
