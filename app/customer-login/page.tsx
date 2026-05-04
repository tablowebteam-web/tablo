import { Suspense } from 'react';
import CustomerLoginClient from './CustomerLoginClient';

export default function CustomerLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-charcoal/50">Loading…</div>}>
      <CustomerLoginClient />
    </Suspense>
  );
}
