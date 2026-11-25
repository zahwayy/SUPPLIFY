<div align="center">
  <img src="public/images/logo-supplify.png" alt="Logo Supplify" width="84" height="84" />
  <h1>Supplify</h1>
  <p><strong>Creative Supplies Warehouse Management System (WMS)</strong></p>
  <p>
    Platform web berarsitektur Modular Monolith untuk mengelola persediaan perlengkapan kreatif, kolaborasi mitra Supplier, pengadaan barang, serta operasional gudang yang tercatat rapi.
  </p>

  <p>
    <img src="https://img.shields.io/badge/Next.js-15-000000?style=flat-square&logo=next.js&logoColor=white" alt="Next.js 15" />
    <img src="https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react&logoColor=white" alt="React 19" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS v4" />
    <img src="https://img.shields.io/badge/PostgreSQL-pg-336791?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
    <img src="https://img.shields.io/badge/Arsitektur-Modular_Monolith-3243DD?style=flat-square" alt="Modular Monolith" />
  </p>

  <p>
    <a href="#-pengenalan-proyek">Pengenalan</a> •
    <a href="#-fitur-utama">Fitur Utama</a> •
    <a href="#-peran-pengguna">Peran Pengguna</a> •
    <a href="#-teknologi-yang-digunakan">Teknologi</a> •
    <a href="#-struktur-proyek">Struktur Proyek</a>
  </p>
</div>

---

## 🎯 Pengenalan Proyek

**Supplify** adalah sistem manajemen gudang (*Warehouse Management System / WMS*) berbasis web yang dirancang untuk mengelola **persediaan barang perlengkapan kreatif** pada tiga kategori utama: **Stationery**, **Office Supplies**, dan **Art Supplies**.

Tujuan utamanya adalah memusatkan pemantauan stok gudang, menstandarkan alur pengadaan hingga distribusi barang, serta menjaga akuntabilitas operasional antara tim internal gudang dan mitra supplier eksternal. Dibangun sebagai satu aplikasi **Modular Monolith**, Supplify memastikan setiap pergerakan stok, inspeksi, dan persetujuan tercatat konsisten.

| Operasional Gudang | Fokus Perlengkapan Kreatif |
| :---: | :---: |
| <img src="public/images/warehouse-illustration.png" alt="Operasional Gudang Supplify" width="280" /> | <img src="public/images/box-illustration.png" alt="Perlengkapan Kreatif Supplify" width="280" /> |

---

## ✨ Fitur Utama

- **Manajemen Produk & Kategori**: Pengelolaan produk, kategori, satuan, harga beli dan jual, lokasi rak, stok minimum, serta gambar produk.
- **Inventaris & Pergerakan Stok**: Pemantauan stok, riwayat pergerakan barang, penyesuaian stok, dan pelaporan selisih inventaris.
- **Manajemen Supplier**: Pendaftaran supplier, verifikasi akun, pengelolaan status, dan pengajuan banding penolakan.
- **Purchase Order (PO)**: Pembuatan pesanan restock, konfirmasi supplier, dan pelacakan pengiriman.
- **Barang Masuk (Incoming)**: Pencatatan penerimaan, pemeriksaan kondisi barang, dan persetujuan barang masuk.
- **Barang Keluar (Outgoing)**: Pengajuan pengeluaran barang, persetujuan, dan proses serah terima.
- **Notifikasi & Log Aktivitas**: Notifikasi aktivitas sistem, pencatatan audit, dan lampiran dokumen bukti.
- **Ekspor Laporan**: Ekspor data operasional dalam format CSV sesuai hak akses pengguna.
---

## 🛡️ Peran Pengguna

Supplify menerapkan *Role-Based Access Control (RBAC)* yang ketat untuk empat peran terautentikasi (ditambah halaman awal publik dan pendaftaran untuk **Guest**):

| Peran | Tanggung Jawab Utama & Batas Akses |
| :--- | :--- |
| **Admin** | Mengelola tata kelola sistem dan data master: mengelola akun internal, memverifikasi pendaftaran dan pengajuan banding 1 kali Supplier, mengelola kategori dan produk (termasuk pengarsipan dan penghapusan aman), memantau inventaris dan pergerakan stok, membaca PO dan transaksi, mengakses `/activity-log`, serta mengekspor CSV untuk seluruh 6 resource. Tidak menyetujui transaksi operasional, penyesuaian stok, maupun discrepancy. |
| **Warehouse Manager** | Memimpin pengadaan dan persetujuan operasional: memiliki akses CRUD penuh pada kategori dan produk (tanpa pengarsipan produk), memantau seluruh 4 tab Inventory Hub, membuat Purchase Order dan meminta inspeksi, menyetujui/menolak transaksi Incoming (menetapkan *Accepted Quantity*) dan Outgoing, menyelesaikan discrepancy serta klaim refund, menyetujui penyesuaian stok, mengakses izin audit, serta mengekspor CSV operasional (`products`, `purchase-orders`, `incoming`, `outgoing`). |
| **Warehouse Staff** | Menjalankan tugas harian operasional gudang: memiliki akses baca pada katalog produk, ringkasan inventaris, discrepancy, dan penyesuaian stok (tanpa log pergerakan stok dan log aktivitas); menginspeksi PO yang tiba; membuat draft Incoming dan permintaan Outgoing; menyelesaikan serah terima Outgoing; melaporkan discrepancy; mengajukan permintaan penyesuaian stok; serta mengekspor CSV khusus transaksi Incoming dan Outgoing miliknya sendiri. |
| **Supplier** | Mengoperasikan portal mitra terpisah setelah disetujui Admin (dengan kesempatan banding 1 kali jika ditolak): melihat Purchase Order yang ditujukan ke perusahaannya, mengonfirmasi atau menolak pesanan, mengunggah detail pengiriman beserta bukti kedatangan barang, dan mengelola profil pribadi. Tidak memiliki akses ke produk internal, inventaris, maupun ekspor CSV. |

### Alur Interaksi Antarperan

1. **Onboarding Mitra:** **Guest** mendaftar sebagai Supplier; **Admin** menyetujui atau menolak pendaftaran (didukung mekanisme banding 1 kali).
2. **Pengadaan hingga Barang Masuk:** **Warehouse Manager** membuat Purchase Order; **Supplier** mengonfirmasi dan mengirim barang; **Warehouse Staff** memeriksa fisik barang masuk; **Warehouse Manager** menyetujui jumlah diterima (atau menindaklanjuti discrepancy) sehingga stok gudang bertambah.
3. **Barang Keluar & Kontrol Stok:** **Warehouse Staff** mengajukan permintaan Outgoing atau penyesuaian stok; **Warehouse Manager** meninjau dan menyetujuinya; **Warehouse Staff** menyelesaikan serah terima Outgoing sehingga stok berkurang.

---

## 🛠️ Teknologi yang Digunakan

| Bidang | Teknologi |
| :--- | :--- |
| **Framework & UI** | Next.js (App Router), React, Tailwind CSS, Lucide React |
| **Bahasa Pemrograman** | JavaScript / JSX |
| **Database** | PostgreSQL (`pg` driver) |
| **Keamanan & Autentikasi** | `bcryptjs`, Node `crypto`, session HTTP-only berbasis database & RBAC |
| **Pengujian** | Test runner bawaan Node.js (`node --test`) |

---

## 📁 Struktur Proyek

```text
SUPPLIFY/
├── database/       # Skema PostgreSQL terpadu dan dataset seed awal
├── public/         # Ilustrasi merek dan aset gambar katalog produk
├── src/
│   ├── app/        # Halaman Next.js App Router, route group, dan API handler
│   ├── components/ # Komponen UI dasar, layout shell, dan komponen fitur
│   ├── lib/        # Database pool, RBAC, helper auth/session, storage, dan konstanta
│   ├── modules/    # Logika domain Modular Monolith (actions, service, validasi, repo)
│   └── middleware.js
└── tests/          # Rangkaian unit test dan integration test PostgreSQL
```
