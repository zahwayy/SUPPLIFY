'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Mail, Lock, AlertCircle, Clock, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { loginAction } from '../../modules/auth/authActions.js';
import Input from '../ui/Input.jsx';
import Button from '../ui/Button.jsx';

const initialState = { ok: true, error: null, fieldErrors: null };

export default function LoginForm({ sessionExpired = false, loggedOut = false }) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      {sessionExpired && !state.error && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900"
        >
          <Clock className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
          <span>Sesi Anda telah berakhir. Silakan masuk kembali untuk melanjutkan.</span>
        </div>
      )}

      {loggedOut && !sessionExpired && !state.error && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900"
        >
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
          <span>Anda telah keluar dari akun. Silakan masuk kembali untuk melanjutkan.</span>
        </div>
      )}

      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
        >
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
          <span>{state.error}</span>
        </div>
      )}

      <Input
        id="email"
        name="email"
        type="email"
        label="Email"
        icon={Mail}
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="nama@perusahaan.com"
        error={state.fieldErrors?.email}
      />

      <div className="w-full">
        <label
          htmlFor="password"
          className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5"
        >
          Kata Sandi
          <span className="ml-0.5 text-[#FF3D8B]" aria-hidden="true">
            *
          </span>
        </label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            aria-invalid={Boolean(state.fieldErrors?.password)}
            placeholder="Masukkan kata sandi"
            className={`w-full rounded-lg border bg-white py-2 pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 ${
              state.fieldErrors?.password
                ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                : 'border-slate-300 focus:border-[#3243DD] focus:ring-[#3243DD]/20'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[28px] min-w-[28px] flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3243DD] cursor-pointer"
            aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {state.fieldErrors?.password && (
          <p className="mt-1 text-xs font-medium text-red-600">
            {state.fieldErrors.password}
          </p>
        )}
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={isPending}
        className="w-full"
      >
        {isPending ? 'Memproses...' : 'Masuk ke Sistem'}
      </Button>

      <div className="pt-2 text-center text-sm text-slate-600">
        Ingin bermitra sebagai Supplier?{' '}
        <Link
          href="/register"
          className="font-semibold text-[#3243DD] hover:text-[#FF3D8B] transition-colors"
        >
          Daftar Supplier
        </Link>
      </div>
    </form>
  );
}
