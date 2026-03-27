import AuthForm from '@/components/AuthForm';

export const metadata = {
  title: 'Inloggen — Oyaa.',
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-hero px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <h1 className="font-[family-name:var(--font-lexend)] text-5xl font-bold text-text">
            Oyaa<span className="text-orange">.</span>
          </h1>
          <p className="text-text-sec text-base mt-3">
            Van gesprek naar geregeld, in minuten.
          </p>
        </div>
        <AuthForm />
      </div>
    </div>
  );
}
