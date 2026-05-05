import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="font-serif text-2xl tracking-tight">tablo</span>
        </div>
        <nav className="flex items-center gap-6 text-sm">
          <a href="#features" className="hidden sm:inline text-charcoal/70 hover:text-charcoal">Features</a>
          <a href="#pricing" className="hidden sm:inline text-charcoal/70 hover:text-charcoal">Pricing</a>
          <Link href="/login" className="text-charcoal/70 hover:text-charcoal">Sign in</Link>
          <Link href="/login" className="px-4 py-2 bg-charcoal text-white rounded-md text-sm hover:bg-charcoal/90">
            Get started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="px-6 pt-16 pb-20 max-w-4xl mx-auto text-center">
        <div className="inline-block px-3 py-1 bg-cream rounded-full text-xs tracking-widest text-forest font-medium mb-6">
          THE RESTAURANT OPERATING SYSTEM
        </div>
        <h1 className="font-serif text-5xl sm:text-6xl leading-tight tracking-tight">
          Hospitality,<br />
          <span className="italic text-forest">orchestrated.</span>
        </h1>
        <p className="mt-6 text-lg text-charcoal/70 max-w-xl mx-auto">
          QR self-ordering, kitchen display, table reservations, and guest memory — built for the way modern restaurants run.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/login" className="px-6 py-3 bg-forest text-white rounded-md hover:bg-forest/90 font-medium">
            Start free →
          </Link>
          <Link href="/r/sahiba/t/7" className="px-6 py-3 border border-charcoal/20 rounded-md hover:bg-cream">
            See guest demo
          </Link>
        </div>
        <p className="text-xs text-charcoal/50 mt-4">No credit card · Set up in under 5 minutes</p>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-20 bg-white border-y border-charcoal/10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="text-xs tracking-widest text-charcoal/50 mb-2">FEATURES</div>
            <h2 className="font-serif text-4xl">Everything your restaurant runs on.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map(f => (
              <div key={f.title} className="p-6 rounded-lg border border-charcoal/10 bg-white">
                <div className="w-10 h-10 rounded-md bg-cream flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="font-serif text-xl mb-2">{f.title}</h3>
                <p className="text-sm text-charcoal/70 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-20 max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <div className="text-xs tracking-widest text-charcoal/50 mb-2">PRICING</div>
          <h2 className="font-serif text-4xl">Simple, transparent.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map(p => (
            <div key={p.name} className={`p-6 rounded-lg border ${p.featured ? 'border-forest border-2 bg-white' : 'border-charcoal/10 bg-white'}`}>
              {p.featured && <div className="inline-block px-2 py-0.5 bg-forest text-white text-xs rounded mb-3">Most popular</div>}
              <div className="font-serif text-2xl">{p.name}</div>
              <div className="font-serif text-4xl mt-2">₹{p.price}<span className="text-base text-charcoal/50">/mo</span></div>
              <ul className="mt-6 space-y-2 text-sm">
                {p.features.map(f => <li key={f} className="flex gap-2"><span className="text-forest">✓</span>{f}</li>)}
              </ul>
              <Link href="/login" className="block text-center mt-6 px-4 py-2 bg-charcoal text-white rounded text-sm hover:bg-charcoal/90">
                Start with {p.name}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 bg-forest text-white text-center">
        <h2 className="font-serif text-4xl mb-3">Ready to orchestrate yours?</h2>
        <p className="text-white/80 max-w-md mx-auto mb-8">Set up your restaurant in 5 minutes. No credit card.</p>
        <Link href="/login" className="inline-block px-8 py-3 bg-white text-forest rounded-md font-medium hover:bg-cream">
          Start free →
        </Link>
      </section>

      <footer className="px-6 py-10 text-center text-sm text-charcoal/50 border-t border-charcoal/10">
        © {new Date().getFullYear()} Tablo. Every guest, remembered.
      </footer>
    </main>
  );
}

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r="26" fill="none" stroke="#0F6E56" strokeWidth="2"/>
      <path d="M 16 22 L 40 22" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M 28 22 L 28 40" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="28" cy="22" r="3" fill="#0F6E56"/>
    </svg>
  );
}

const features = [
  { title: 'QR self-ordering', desc: 'Guests scan, browse, order, and pay from their phone. No app, no waiting.', icon: <span className="text-forest text-lg">⌗</span> },
  { title: 'Kitchen display', desc: 'Live order queue with course firing. Replace paper tickets forever.', icon: <span className="text-forest text-lg">▤</span> },
  { title: 'Menu management', desc: 'Add dishes, upload photos, mark items unavailable — all in seconds.', icon: <span className="text-forest text-lg">⊞</span> },
  { title: 'Real-time sync', desc: 'Orders flow from phone to kitchen in under a second. Status updates live.', icon: <span className="text-forest text-lg">⚡</span> },
  { title: 'Multi-tenant secure', desc: 'Database-level isolation — each restaurant\'s data stays private.', icon: <span className="text-forest text-lg">🛡</span> },
  { title: 'Magic-link login', desc: 'No passwords, no support tickets. Sign in with email, that\'s it.', icon: <span className="text-forest text-lg">✦</span> }
];

const plans = [
  { name: 'Starter', price: '4,999', featured: false, features: ['QR ordering', 'Kitchen display', '1 outlet', 'Email support'] },
  { name: 'Pro', price: '9,999', featured: true, features: ['Everything in Starter', 'Reservations', 'Inventory', 'Guest CRM', 'Priority support'] },
  { name: 'Signature', price: '14,999', featured: false, features: ['Everything in Pro', 'Multi-outlet', 'AI Advisor', 'White-label QR', 'Dedicated success'] }
];
