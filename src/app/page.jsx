import Image from 'next/image';
import Link from 'next/link';
import {
  PenTool,
  Briefcase,
  Palette,
  ArrowRight,
} from 'lucide-react';
import GuestNavbar from '../components/layout/GuestNavbar.jsx';

const CATEGORY_CARDS = [
  {
    id: 'sta',
    title: 'Alat Tulis (Stationery)',
    description: 'Pensil, pulpen gel, penghapus, penggaris, dan drawing pen.',
    icon: PenTool,
    surfaceCls: 'bg-[#EEF1FD]/70 border-[#3243DD]/25',
    notchCls: 'bg-[#3243DD]/12 border-[#3243DD]/20 text-[#3243DD]',
  },
  {
    id: 'off',
    title: 'Perlengkapan Kantor',
    description: 'Sticky notes, stapler, paper clip, folder dokumen, dan binder clip.',
    icon: Briefcase,
    surfaceCls: 'bg-white border-slate-200/90',
    notchCls: 'bg-slate-100 border-slate-200 text-[#3243DD]',
  },
  {
    id: 'art',
    title: 'Perlengkapan Seni',
    description: 'Sketchbook A4, watercolor set, acrylic paint, kuas lukis, dan canvas.',
    icon: Palette,
    surfaceCls: 'bg-[#FFF0F6]/70 border-[#FF3D8B]/25',
    notchCls: 'bg-[#FF3D8B]/12 border-[#FF3D8B]/25 text-[#C81D67]',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen supplify-ambient-bg text-slate-900 overflow-x-clip flex flex-col">
      <a href="#content" className="visually-hidden supplify-skip-link">
        Lewati ke konten utama
      </a>

      {/* Navbar Atas */}
      <GuestNavbar />

      <main className="flex-1">
        {/* Bagian 1: Hero */}
        <section id="beranda" className="relative pt-6 pb-10 sm:pt-10 sm:pb-14">
          <div className="supplify-container">
            <div className="mx-auto max-w-4xl text-center">
              <h1
                id="content"
                tabIndex={-1}
                className="text-3xl sm:text-5xl lg:text-[52px] font-extrabold tracking-tight text-slate-900 leading-[1.15] focus:outline-none text-balance"
              >
                Persediaan Terkelola,
                <br />
                Operasional{' '}
                <span className="text-[#FF3D8B]">Lebih Terarah.</span>
              </h1>

              <p className="mt-4 mx-auto max-w-2xl text-sm sm:text-base text-slate-600 leading-relaxed">
                Pantau ketersediaan stok, kelola transaksi barang masuk dan keluar,
                serta koordinasikan pemesanan dengan mitra supplier secara terpadu.
              </p>

              <div className="mt-6 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] w-full sm:w-auto rounded-xl bg-[#3243DD] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#2635BC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3243DD] focus-visible:ring-offset-2 transition-colors"
                >
                  Masuk ke Sistem
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] w-full sm:w-auto rounded-xl border border-[#FF3D8B]/70 bg-white px-6 py-2.5 text-sm font-semibold text-[#C81D67] hover:bg-[#FFF0F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3D8B] focus-visible:ring-offset-2 transition-colors"
                >
                  Daftar sebagai Supplier
                </Link>
              </div>
            </div>

            {/* Ilustrasi Gudang Hero */}
            <div className="relative mx-auto mt-8 max-w-3xl">
              <div
                className="pointer-events-none absolute inset-x-10 top-6 bottom-4 rounded-full bg-[#FF3D8B]/10 blur-3xl"
                aria-hidden="true"
              />
              <div className="relative flex justify-center">
                <Image
                  src="/images/warehouse-illustration.png"
                  alt="Ilustrasi gudang dan kotak persediaan Supplify"
                  width={680}
                  height={420}
                  className="w-full max-w-[540px] h-auto object-contain drop-shadow-md"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        {/* Bagian 2: Tentang Supplify */}
        <section id="tentang" className="py-8 sm:py-12 lg:py-16">
          <div className="supplify-container grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-12 items-center">
            <div className="lg:col-span-7 space-y-4 min-w-0">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900">
                Mengenal Supplify
              </h2>

              <div className="space-y-3 text-sm sm:text-base text-slate-700 leading-relaxed max-w-2xl">
                <p>
                  <strong className="font-semibold text-slate-900">Supplify</strong>{' '}
                  merupakan sistem manajemen gudang berbasis web yang berfokus pada
                  pengelolaan persediaan Alat Tulis Kantor (ATK) dan perlengkapan
                  kreatif.
                </p>
                <p>
                  Melalui satu platform, tim gudang dapat mendata produk, memantau
                  stok minimum, mencatat barang masuk dan keluar, serta mengelola
                  pesanan pembelian kepada supplier.
                </p>
              </div>

              {/* 3 Kartu Kategori dengan Variasi Permukaan Brand */}
              <div className="pt-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {CATEGORY_CARDS.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.id}
                      className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 pb-10 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-transform hover:-translate-y-0.5 ${card.surfaceCls}`}
                    >
                      <h3 className="text-sm font-bold text-slate-900">
                        {card.title}
                      </h3>
                      <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                        {card.description}
                      </p>

                      <div
                        className={`absolute -bottom-3 -right-3 flex h-13 w-13 items-center justify-center rounded-tl-full border-t border-l ${card.notchCls}`}
                        aria-hidden="true"
                      >
                        <Icon className="h-4 w-4 -translate-x-1 -translate-y-1" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ilustrasi Kanan */}
            <div className="lg:col-span-5 relative flex justify-center">
              <div
                className="pointer-events-none absolute -inset-4 rounded-[48px] bg-[#FF3D8B]/12 blur-2xl"
                aria-hidden="true"
              />
              <Image
                src="/images/box-illustration.png"
                alt="Ilustrasi kotak perlengkapan alat tulis dan seni"
                width={440}
                height={480}
                className="relative w-full max-w-[380px] h-auto object-contain"
              />
            </div>
          </div>
        </section>

        {/* Bagian 3: Kemitraan Supplier */}
        <section id="kemitraan" className="pt-4 pb-12 sm:pb-14">
          <div className="supplify-container">
            <div className="rounded-3xl bg-[#3243DD] text-white border border-[#2635BC] shadow-sm p-5 sm:p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-center">
              <div className="lg:col-span-8 space-y-2.5">
                <h2 className="text-2xl sm:text-3xl font-bold text-white">
                  Bergabung sebagai Mitra Supplier Terverifikasi
                </h2>
                <p className="text-sm text-white/90 leading-relaxed max-w-2xl">
                  Daftarkan perusahaan Anda dan pilih kategori barang yang disediakan
                  untuk menerima Purchase Order langsung melalui portal Supplify.
                </p>
              </div>

              <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 lg:items-end">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-[#C81D67] hover:bg-[#FFF0F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors w-full sm:w-auto lg:w-64"
                >
                  Daftar sebagai Supplier
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200/80 bg-white/80 py-5 text-center text-xs text-slate-500">
        <div className="supplify-container">
          © {new Date().getFullYear()} Supplify: Sistem Manajemen Gudang Perlengkapan Kreatif &amp; ATK.
        </div>
      </footer>
    </div>
  );
}
