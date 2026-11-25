import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/auth/session.js';
import LoginForm from '../../../components/auth/LoginForm.jsx';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }) {
  const user = await getCurrentUser();
  if (user) {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const sessionExpired = params?.expired === '1';
  const loggedOut = params?.loggedOut === '1';

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg sm:text-xl font-bold text-slate-900">
          Masuk ke Akun Supplify
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Gunakan email dan kata sandi akun Supplify Anda.
        </p>
      </div>
      <LoginForm sessionExpired={sessionExpired} loggedOut={loggedOut} />
    </div>
  );
}
