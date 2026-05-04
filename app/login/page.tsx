import { Suspense } from 'react';
import LoginClient from './LoginClient';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-charcoal/50">Loading…</div>}>
      <LoginClient />
    </Suspense>
  );
}