export const dynamic = 'force-dynamic';

import AuthForm from '@/components/AuthForm';

export const metadata = {
  title: 'Inloggen \u2014 Waybetter.',
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark relative overflow-hidden px-6">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-[10%] left-[20%] w-[400px] h-[400px] rounded-full bg-orange/[0.04] blur-[120px]" />
        <div className="absolute bottom-[10%] right-[20%] w-[300px] h-[300px] rounded-full bg-orange/[0.03] blur-[100px]" />
      </div>

      <div className="relative w-full max-w-[380px]">
        <div className="mb-10 text-center">
          <h1 className="font-[family-name:var(--font-lexend)] text-3xl tracking-[0.15em] font-bold text-orange uppercase mb-3">
            Waybetter
          </h1>
          <p className="text-[15px] text-white/40 font-[family-name:var(--font-outfit)] mb-2">
            Jouw bureau cockpit
          </p>
          <p className="text-[11px] tracking-[0.2em] font-semibold text-orange/60 uppercase font-[family-name:var(--font-outfit)]">
            Made for agency people
          </p>
        </div>
        <AuthForm />
      </div>
    </div>
  );
}
