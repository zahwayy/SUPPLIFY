<div align="center">
  <img src="public/images/logo-supplify.png" alt="Logo Supplify" width="84" height="84" />
  <h1>Supplify</h1>
  <p><strong>Creative Supplies Warehouse Management System (WMS)</strong></p>
  <p>
    Sistem manajemen gudang berbasis web untuk pengelolaan persediaan perlengkapan kreatif, pengadaan bersama mitra supplier, dan pencatatan operasional gudang secara terpusat.
  </p>

  <p>
    <img src="https://img.shields.io/badge/Next.js-15-000000?style=flat-square&logo=next.js&logoColor=white" alt="Next.js 15" />
    <img src="https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react&logoColor=white" alt="React 19" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS v4" />
    <img src="https://img.shields.io/badge/PostgreSQL-pg-336791?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  </p>
</div>

---

## 📋 Daftar Isi

- [🎯 Tentang Supplify](#-tentang-supplify)
- [✨ Fitur Utama](#-fitur-utama)
- [👥 Role Pengguna](#-role-pengguna)
- [🛠️ Teknologi yang Digunakan](#-teknologi-yang-digunakan)
- [💻 Persyaratan Sistem](#-persyaratan-sistem)
- [🚀 Instalasi](#-instalasi)
- [⚙️ Konfigurasi Environment](#-konfigurasi-environment)
- [📁 Struktur Proyek](#-struktur-proyek)
- [📖 Panduan Penggunaan](#-panduan-penggunaan)
- [🧪 Pengujian](#-pengujian)
- [📚 Dokumentasi & Pengembangan](#-dokumentasi--pengembangan)

---

## 🎯 Tentang Supplify

**Supplify** adalah aplikasi web *Warehouse Management System (WMS)* untuk mengelola persediaan barang *creative supplies*, mencakup kategori seperti **Stationery**, **Office Supplies**, dan **Art Supplies**.

Dalam operasional gudang sehari-hari, pencatatan stok yang terpisah antara pengadaan, penerimaan, dan pengeluaran barang sering menimbulkan selisih data serta koordinasi yang lambat dengan supplier. Supplify hadir untuk menyatukan alur pengelolaan katalog, pemantauan stok, pemesanan ke supplier, hingga pelaporan operasional dalam satu aplikasi berbasis **Modular Monolith** dengan kontrol akses berbasis peran (RBAC).

---

## ✨ Fitur Utama

- **Manajemen Produk & Kategori**: Pengelolaan data produk, kategori, SKU, satuan, harga beli dan jual, lokasi rak, batas stok minimum, serta gambar produk.
- **Inventaris & Pergerakan Stok**: Pemantauan ketersediaan stok real-time, klasifikasi status stok, serta riwayat pergerakan barang masuk, keluar, dan penyesuaian.
- **Manajemen Supplier**: Pendaftaran mandiri mitra supplier, verifikasi akun oleh Admin, pengelolaan status kemitraan, dan pengajuan banding jika pendaftaran ditolak.
- **Purchase Order (PO)**: Pembuatan pesanan restock kepada supplier terverifikasi, konfirmasi pesanan, serta pelacakan status pengiriman.
- **Barang Masuk (Incoming)**: Pencatatan penerimaan fisik barang dari PO, pemeriksaan kondisi barang, dan persetujuan masuk ke stok gudang.
- **Barang Keluar (Outgoing)**: Pengajuan permintaan pengeluaran barang, peninjauan, serta pencatatan serah terima pengiriman.
- **Discrepancy & Stock Adjustment**: Pelaporan temuan ketidaksesuaian stok (selisih, rusak, atau hilang) dan pengajuan penyesuaian stok yang terdokumentasi.
- **Notifikasi, Log Aktivitas, & Ekspor Laporan**: Notifikasi lintas peran, lampiran bukti transaksi, pencatatan audit aktivitas sistem, serta ekspor laporan dalam format CSV.

---

## 👥 Role Pengguna

Supplify menerapkan *Role-Based Access Control (RBAC)* untuk memisahkan kewenangan empat peran terautentikasi:

| Role | Tanggung Jawab Utama & Batas Akses |
| :--- | :--- |
| **Admin** | Mengelola akun internal, memverifikasi pendaftaran dan banding Supplier, mengelola penuh kategori serta produk (termasuk pengarsipan dan penghapusan aman), memantau inventaris, PO, transaksi, log aktivitas, serta mengekspor laporan CSV. Tidak menyetujui transaksi operasional, discrepancy, atau penyesuaian stok. |
| **Warehouse Manager** | Mengelola kategori dan produk (CRUD penuh tanpa pengarsipan), membuat Purchase Order, menyetujui atau menolak transaksi Incoming dan Outgoing, menyelesaikan laporan discrepancy, menyetujui penyesuaian stok, membaca log aktivitas, serta mengekspor CSV operasional. |
| **Warehouse Staff** | Melihat katalog produk, inventaris, dan PO; melakukan inspeksi barang masuk, membuat catatan Incoming dan pengajuan Outgoing, menyelesaikan serah terima Outgoing, melaporkan discrepancy, mengajukan penyesuaian stok, serta mengekspor CSV transaksi miliknya sendiri. |
| **Supplier** | Mengakses portal mitra setelah akun disetujui Admin untuk melihat dan merespons Purchase Order miliknya serta mengelola detail dan riwayat pengiriman barang. Tidak memiliki akses ke katalog internal, inventaris, atau ekspor CSV. |

---

## 🛠️ Teknologi yang Digunakan

| Kategori | Teknologi |
| :--- | :--- |
| **Framework & Frontend** | Next.js 15 (App Router), React 19, JavaScript / JSX |
| **Styling & UI** | Tailwind CSS v4, Lucide React |
| **Backend & Database** | Next.js Server Actions & Route Handlers (API), PostgreSQL, `pg` |
| **Tools & Dependencies** | `bcryptjs`, Node.js `crypto`, Node.js Test Runner (`node --test`), PostCSS |

---

## 💻 Persyaratan Sistem

Pastikan perangkat lokal sudah memiliki software berikut sebelum menjalankan aplikasi:

- **Node.js** (direkomendasikan v20 LTS ke atas)
- **npm** (terpasang bersama Node.js)
- **PostgreSQL** (lokal atau server yang dapat diakses)
- **Git**

---

## 🚀 Instalasi

### 1. Clone Repository

```bash
git clone https://github.com/zahwayy/SUPPLIFY.git
```

### 2. Masuk ke Folder Project

```bash
cd SUPPLIFY
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Setup Environment

Salin file `.env.example` menjadi `.env.local`, lalu sesuaikan nilainya (lihat bagian [Konfigurasi Environment](#-konfigurasi-environment)).

- **Windows (Command Prompt):**
  ```cmd
  copy .env.example .env.local
  ```
- **Windows (PowerShell) / macOS / Linux:**
  ```bash
  cp .env.example .env.local
  ```

### 5. Konfigurasi Database

1. Buat database kosong baru di PostgreSQL melalui `psql` atau pgAdmin (misalnya `supplify`).
2. Pastikan `DATABASE_URL` di `.env.local` mengarah ke kredensial dan nama database yang baru dibuat.
3. Jalankan file skema tabel dan data awal yang tersedia di `src/database/`:

```bash
psql -U postgres -d NAMA_DATABASE -f src/database/migrations/schema.sql
psql -U postgres -d NAMA_DATABASE -f src/database/seeds/seed.sql
```

> Jika menggunakan **pgAdmin**, buka **Query Tool** pada database tujuan, lalu jalankan isi `src/database/migrations/schema.sql` terlebih dahulu dan lanjutkan dengan `src/database/seeds/seed.sql`.

### 6. Jalankan Aplikasi

```bash
npm run dev
```

Buka browser dan akses aplikasi di `http://localhost:3000`.

---

## ⚙️ Konfigurasi Environment

Aplikasi membaca konfigurasi dari `.env.local` berdasarkan template `.env.example`. Berikut variabel utama yang digunakan:

| Variabel | Keterangan |
| :--- | :--- |
| `NODE_ENV` | Mode environment aplikasi (misalnya `development` atau `production`). |
| `APP_URL` | URL dasar aplikasi (default lokal: `http://localhost:3000`). |
| `DATABASE_URL` | Connection string PostgreSQL (`postgresql://user:password@host:port/dbname`). Wajib diisi. |
| `SESSION_SECRET` | String acak minimal 32 karakter untuk menandatangani token dan sesi autentikasi. Wajib diisi. |
| `SESSION_TTL_DAYS` | Masa berlaku sesi login dalam hitungan hari (default: `7`). |
| `STORAGE_ROOT` | Direktori penyimpanan lokal file lampiran bukti di luar folder `public/` (default: `./storage/uploads`). |
| `MAX_UPLOAD_SIZE_MB` | Batas maksimal ukuran unggahan file bukti dalam megabyte (default: `5`). |

Contoh format `.env.local`:

```env
NODE_ENV=development
APP_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/YOUR_DATABASE_NAME
SESSION_SECRET=replace_with_a_random_32_char_secret_string
SESSION_TTL_DAYS=7
STORAGE_ROOT=./storage/uploads
MAX_UPLOAD_SIZE_MB=5
```

> Jangan pernah mengunggah `.env.local` atau menyimpan kredensial asli ke repository Git.

---

## 📁 Struktur Proyek

```text
SUPPLIFY/
├── public/                 # Asset statis, ilustrasi, dan gambar katalog produk
├── src/
│   ├── app/                # Halaman Next.js App Router, layout, dan API routes
│   ├── components/         # Komponen UI dasar, layout shell, dan komponen fitur
│   ├── database/           # Skema PostgreSQL (migrations/schema.sql) dan data awal (seeds/seed.sql)
│   ├── lib/                # Database pool, autentikasi, session, RBAC, storage, dan helper
│   ├── modules/            # Modul fitur dan logic bisnis (actions, service, validasi, repository)
│   └── middleware.js       # Proteksi route berdasarkan status autentikasi
└── tests/                  # Rangkaian unit test dan integration test PostgreSQL
```

---

## 📖 Panduan Penggunaan

Setelah aplikasi berjalan di `http://localhost:3000`, pengguna dapat masuk melalui halaman `/login` atau mendaftar sebagai mitra baru melalui `/register`.

- **Admin**: Masuk ke dashboard untuk mengelola pengguna internal, memverifikasi pendaftaran supplier, mengatur katalog produk dan kategori, serta memantau audit aktivitas dan laporan CSV.
- **Warehouse Manager**: Mengelola produk dan kategori, membuat pesanan restock (PO) ke supplier, serta meninjau persetujuan barang masuk, barang keluar, discrepancy, dan penyesuaian stok.
- **Warehouse Staff**: Memeriksa kedatangan barang dari PO, mencatat penerimaan dan pengeluaran barang, menyelesaikan serah terima pengiriman, serta melaporkan temuan selisih stok.
- **Supplier**: Mengakses portal supplier untuk meninjau pesanan masuk, mengonfirmasi ketersediaan, serta mengunggah detail pengiriman barang ke gudang.

### Akun Demo Lokal (dari `seed.sql`)

Jika kamu menjalankan `src/database/seeds/seed.sql`, tersedia 4 akun pengujian lokal (khusus development/testing) dengan kata sandi **`SupplifyTest123!`**:

| Role | Email |
| :--- | :--- |
| Admin | `admin@supplify.local` |
| Warehouse Manager | `manager@supplify.local` |
| Warehouse Staff | `staff@supplify.local` |
| Supplier | `supplier@supplify.local` |

---

## 🧪 Pengujian

Supplify menggunakan test runner bawaan Node.js (`node --test`) yang tersimpan di folder `tests/unit/` dan `tests/integration/`.

- **Menjalankan seluruh unit test (tanpa koneksi PostgreSQL):**
  ```bash
  node --test tests/unit/*.test.js
  ```
- **Menjalankan seluruh suite (unit + integration test PostgreSQL):**
  ```bash
  npm test
  ```
  > Jika menjalankan integration test ke PostgreSQL lokal dan ingin menghindari konflik paralel antarfile test, gunakan:
  > ```bash
  > node --test --test-concurrency=1 tests/**/*.test.js
  > ```
- **Memverifikasi build produksi:**
  ```bash
  npm run build
  ```

---

## 📚 Dokumentasi & Pengembangan

Seluruh panduan inti proyek tersedia di `README.md`, dengan definisi skema database pada `src/database/migrations/schema.sql` dan data awal pada `src/database/seeds/seed.sql`.

Proyek ini disusun dengan pola **Modular Monolith** di bawah `src/modules/`, sehingga penambahan fitur baru, penyesuaian permission RBAC (`src/lib/auth/rbac.js`), maupun perluasan API dan komponen UI dapat dilakukan secara terisolasi per modul.
