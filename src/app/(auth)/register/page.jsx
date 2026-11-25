import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/auth/session.js';
import { listPublicCategories } from '../../../modules/categories/categoryRepo.js';
import RegisterForm from '../../../components/auth/RegisterForm.jsx';

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect('/dashboard');
  }

  const categories = await listPublicCategories().catch(() => []);

  return (
    <div>
      <div className="mb-5">
        <span className="inline-block rounded-full bg-[#FF3D8B]/10 px-2.5 py-0.5 text-xs font-semibold text-[#C81D67]">
          Registrasi Supplier
        </span>
        <h2 className="mt-2 text-lg font-semibold text-slate-900">
          Daftar Akun Supplier Baru
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Lengkapi profil perusahaan beserta kategori barang yang disediakan. Pendaftaran
          akan diverifikasi Admin sebelum Anda dapat masuk ke sistem.
        </p>
      </div>
      <RegisterForm categories={categories} />
    </div>
  );
}
