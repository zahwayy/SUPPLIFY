import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata = {
  title: 'Supplify — Creative Supplies Warehouse Management System',
  description:
    'Sistem manajemen gudang untuk pengelolaan produk, stok, transaksi barang masuk/keluar, dan Purchase Order supplier.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="min-h-screen bg-[#F4F5F8] text-slate-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
