'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Step = 1 | 2 | 3 | 4;

export default function OnboardingClient({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');

  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [taxRate, setTaxRate] = useState('5');

  const [tableCount, setTableCount] = useState('6');
  const [firstCategoryName, setFirstCategoryName] = useState('Mains');

  // Auto-generate slug from name (until user manually edits)
  useEffect(() => {
    if (!slugManuallyEdited) {
      const auto = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 32);
      setSlug(auto);
    }
  }, [name, slugManuallyEdited]);

  // Check slug availability with debounce
  useEffect(() => {
    if (!slug || slug.length < 3) {
      setSlugStatus('idle');
      return;
    }
    setSlugStatus('checking');
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/restaurants?slug=${encodeURIComponent(slug)}`);
        const data = await res.json();
        if (data.reason === 'invalid') setSlugStatus('invalid');
        else setSlugStatus(data.available ? 'available' : 'taken');
      } catch {
        setSlugStatus('idle');
      }
    }, 400);
    return () => clearTimeout(t);
  }, [slug]);

  const canAdvanceStep1 = name.trim().length >= 2 && slugStatus === 'available';
  const canAdvanceStep2 = true; // address/phone/taxRate are optional
  const canAdvanceStep3 = Number(tableCount) >= 1 && Number(tableCount) <= 100;
  const canSubmit = firstCategoryName.trim().length > 0;

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          tagline: tagline.trim() || null,
          address: address.trim() || null,
          phone: phone.trim() || null,
          taxRate: Number(taxRate) || 5,
          tableCount: Number(tableCount) || 6,
          firstCategoryName: firstCategoryName.trim()
        })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong');
        setSubmitting(false);
        return;
      }

      // Success! Redirect to the new restaurant's menu (where they'll add items)
      router.push(`/admin/${data.slug}/menu`);
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? 'Network error');
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FBFAF7] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center gap-2">
            <svg width="28" height="28" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="26" fill="none" stroke="#0F6E56" strokeWidth="2"/>
              <path d="M 16 22 L 40 22" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M 28 22 L 28 40" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="28" cy="22" r="3" fill="#0F6E56"/>
            </svg>
            <span className="font-serif text-2xl">tablo</span>
          </div>
          <p className="text-xs tracking-widest text-charcoal/50 mt-2">SET UP YOUR RESTAURANT</p>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3, 4].map(s => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full transition-colors ${
                s <= step ? 'bg-forest' : 'bg-charcoal/15'
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-lg border border-charcoal/10 p-6 shadow-sm">
          {step === 1 && (
            <>
              <h2 className="font-serif text-2xl mb-1">What's your restaurant called?</h2>
              <p className="text-sm text-charcoal/60 mb-5">This is what your guests will see.</p>

              <Field label="Restaurant name">
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Sahiba Fine Dining"
                  className="w-full px-3 py-2.5 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                  autoFocus
                  maxLength={80}
                />
              </Field>

              <Field label="Tagline (optional)">
                <input
                  type="text"
                  value={tagline}
                  onChange={e => setTagline(e.target.value)}
                  placeholder="Modern Indian, masterfully plated."
                  className="w-full px-3 py-2.5 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                  maxLength={120}
                />
              </Field>

              <Field
                label="Your URL"
                hint="This will be your QR code URL. You can change it later."
              >
                <div className="flex items-center border border-charcoal/15 rounded-md overflow-hidden focus-within:border-forest">
                  <span className="px-3 py-2.5 bg-charcoal/5 text-xs text-charcoal/60 border-r border-charcoal/10">
                    .../r/
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={e => {
                      setSlug(e.target.value.toLowerCase());
                      setSlugManuallyEdited(true);
                    }}
                    placeholder="sahiba-fine-dining"
                    className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
                    maxLength={32}
                  />
                  <span className="pr-3 text-xs">
                    {slugStatus === 'checking' && <span className="text-charcoal/40">…</span>}
                    {slugStatus === 'available' && <span className="text-emerald-700">✓</span>}
                    {slugStatus === 'taken' && <span className="text-red-700">taken</span>}
                    {slugStatus === 'invalid' && <span className="text-amber-700">invalid</span>}
                  </span>
                </div>
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="font-serif text-2xl mb-1">Where are you located?</h2>
              <p className="text-sm text-charcoal/60 mb-5">All optional — you can update these any time.</p>

              <Field label="Address">
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="12 Marine Drive, Kochi, Kerala"
                  className="w-full px-3 py-2.5 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                  autoFocus
                />
              </Field>

              <Field label="Phone">
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91 98470 12345"
                  className="w-full px-3 py-2.5 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                />
              </Field>

              <Field label="GST / Tax rate (%)" hint="What % is added to the bill as tax. India default is 5%.">
                <input
                  type="number"
                  value={taxRate}
                  onChange={e => setTaxRate(e.target.value)}
                  step="0.5"
                  min="0"
                  max="50"
                  className="w-32 px-3 py-2.5 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                />
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="font-serif text-2xl mb-1">How many tables?</h2>
              <p className="text-sm text-charcoal/60 mb-5">Each table gets its own QR code. You can add or remove tables later.</p>

              <Field label="Number of tables" hint="Don't worry if you're not sure — we'll auto-generate them numbered 1 through N.">
                <input
                  type="number"
                  value={tableCount}
                  onChange={e => setTableCount(e.target.value)}
                  min="1"
                  max="100"
                  className="w-32 px-3 py-2.5 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                  autoFocus
                />
              </Field>

              <div className="bg-cream/50 border border-cream rounded-md p-3 text-xs text-forest mt-2">
                💡 We'll create tables 1 through {tableCount || '?'} for you. Each will have a unique QR code you can print after onboarding.
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="font-serif text-2xl mb-1">Last step — start your menu</h2>
              <p className="text-sm text-charcoal/60 mb-5">Add your first menu category. You'll add dishes to it after onboarding.</p>

              <Field label="First category name" hint="Common starters: Appetizers, Mains, Desserts, Drinks, Specials.">
                <input
                  type="text"
                  value={firstCategoryName}
                  onChange={e => setFirstCategoryName(e.target.value)}
                  placeholder="Mains"
                  className="w-full px-3 py-2.5 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                  autoFocus
                  maxLength={40}
                />
              </Field>

              <div className="bg-cream/50 border border-cream rounded-md p-3 text-xs text-forest mt-2">
                ✨ After this, you'll land in your menu editor where you can add dishes, upload photos, and customize everything.
              </div>
            </>
          )}

          {error && (
            <div className="mt-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center mt-6 pt-5 border-t border-charcoal/10">
            <button
              onClick={() => setStep((step - 1) as Step)}
              disabled={step === 1 || submitting}
              className="text-sm text-charcoal/60 hover:text-charcoal disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Back
            </button>

            <div className="text-[11px] text-charcoal/40">Step {step} of 4</div>

            {step < 4 ? (
              <button
                onClick={() => setStep((step + 1) as Step)}
                disabled={
                  (step === 1 && !canAdvanceStep1) ||
                  (step === 2 && !canAdvanceStep2) ||
                  (step === 3 && !canAdvanceStep3)
                }
                className="px-4 py-2 bg-forest text-white rounded text-sm font-medium hover:bg-forest/90 disabled:opacity-50"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="px-5 py-2 bg-forest text-white rounded text-sm font-medium hover:bg-forest/90 disabled:opacity-50"
              >
                {submitting ? 'Setting up…' : 'Create restaurant 🎉'}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-charcoal/50 mt-5">
          Signed in as <strong>{userEmail}</strong> · <a href="/auth/signout" onClick={async (e) => { e.preventDefault(); await fetch('/auth/signout', { method: 'POST' }); window.location.href = '/login'; }} className="underline">Sign out</a>
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-charcoal/70 mb-1.5">{label}</label>
      {children}
      {hint && <div className="text-[11px] text-charcoal/50 mt-1">{hint}</div>}
    </div>
  );
}
