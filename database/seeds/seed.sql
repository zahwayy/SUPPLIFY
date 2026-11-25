-- ============================================================================
-- SUPPLIFY WAREHOUSE MANAGEMENT SYSTEM (WMS)
-- Database Seed Script (PostgreSQL — Idempotent)
--
-- Berisi data awal untuk pengujian & operasional standar:
--   1. 4 akun uji resmi (Admin, Warehouse Manager, Warehouse Staff, Supplier)
--   2. 1 profil perusahaan supplier terverifikasi
--   3. 3 kategori resmi (STA, OFF, ART)
--   4. 15 SKU produk awal lengkap dengan purchase_price, minimum_stock,
--      low_stock_threshold, satuan, dan lokasi rak (stok awal = 0)
--
-- AKUN PENGUJIAN LOKAL (Hanya untuk development/testing)
-- Password seluruh akun : SupplifyTest123!
--   1. Admin             : admin@supplify.local
--   2. Warehouse Manager : manager@supplify.local
--   3. Warehouse Staff   : staff@supplify.local
--   4. Supplier          : supplier@supplify.local
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Users (4 role pengujian)
-- ----------------------------------------------------------------------------
INSERT INTO users (name, email, password_hash, role, status)
VALUES
    ('Admin Supplify',              'admin@supplify.local',    '$2b$12$nYDYjTOPOLC.hiSTS/2kouGBHylNGZR60h76P3Iq1Tbd0XOc8y2ee', 'admin',    'active'),
    ('Warehouse Manager',           'manager@supplify.local',  '$2b$12$nYDYjTOPOLC.hiSTS/2kouGBHylNGZR60h76P3Iq1Tbd0XOc8y2ee', 'manager',  'active'),
    ('Warehouse Staff',             'staff@supplify.local',    '$2b$12$nYDYjTOPOLC.hiSTS/2kouGBHylNGZR60h76P3Iq1Tbd0XOc8y2ee', 'staff',    'active'),
    ('PT Kertas & Kreasi Nusantara','supplier@supplify.local', '$2b$12$nYDYjTOPOLC.hiSTS/2kouGBHylNGZR60h76P3Iq1Tbd0XOc8y2ee', 'supplier', 'active')
ON CONFLICT (email) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Suppliers (1 mitra supplier terverifikasi)
-- ----------------------------------------------------------------------------
INSERT INTO suppliers (
    user_id,
    company_name,
    contact_name,
    phone,
    address,
    verified_by,
    verified_at
)
SELECT
    sup_user.id,
    'PT Kertas & Kreasi Nusantara',
    'Budi Santoso',
    '021-5550192',
    'Jl. Industri Kreatif No. 18, Jakarta Timur',
    adm_user.id,
    NOW()
FROM users sup_user
CROSS JOIN users adm_user
WHERE sup_user.email = 'supplier@supplify.local'
  AND adm_user.email = 'admin@supplify.local'
ON CONFLICT (user_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. Categories (3 kategori resmi)
-- ----------------------------------------------------------------------------
INSERT INTO categories (code, name, description)
VALUES
    ('STA', 'Stationery',      'Alat tulis harian dan perlengkapan menulis.'),
    ('OFF', 'Office Supplies', 'Perlengkapan administrasi dan kebutuhan kantor.'),
    ('ART', 'Art Supplies',    'Perlengkapan seni, menggambar, dan melukis.')
ON CONFLICT (name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3b. Supplier Categories (relasi kategori supplier terverifikasi)
-- ----------------------------------------------------------------------------
INSERT INTO supplier_categories (supplier_id, category_id)
SELECT s.id, c.id
FROM suppliers s
INNER JOIN users u ON u.id = s.user_id
CROSS JOIN categories c
WHERE u.email = 'supplier@supplify.local'
  AND c.code IN ('STA', 'OFF', 'ART')
ON CONFLICT (supplier_id, category_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. Products (15 SKU awal)
-- ----------------------------------------------------------------------------
INSERT INTO products (
    category_id,
    sku,
    name,
    description,
    purchase_price,
    stock,
    minimum_stock,
    low_stock_threshold,
    unit,
    rack_location,
    image_path
)
SELECT
    c.id,
    v.sku,
    v.name,
    v.description,
    v.purchase_price,
    0,
    v.minimum_stock,
    v.low_stock_threshold,
    v.unit,
    v.rack_location,
    v.image_path
FROM (
    VALUES
        -- Kategori STA : Stationery
        ('STA', 'STA-001', 'Pensil HB 2',        'Pensil grafit HB 2 untuk menulis dan sketsa harian.',                  3500.00::NUMERIC(14, 2),  20, 40, 'PCS',   'A-01', '/images/products/11_Pensil_HB_2.webp'),
        ('STA', 'STA-002', 'Pulpen Gel 0.5 mm',  'Pulpen tinta gel hitam ujung jarum 0.5 mm.',                          5500.00::NUMERIC(14, 2),  25, 50, 'PCS',   'A-02', '/images/products/12_Pulpen_Gel_0.5mm.webp'),
        ('STA', 'STA-003', 'Penghapus Putih',    'Penghapus karet putih lembut bebas debu.',                            4000.00::NUMERIC(14, 2),  15, 30, 'PCS',   'A-03', '/images/products/13_Penghapus_Putih.webp'),
        ('STA', 'STA-004', 'Penggaris 30 cm',    'Penggaris akrilik bening 30 cm dengan skala milimeter.',              7500.00::NUMERIC(14, 2),  10, 25, 'PCS',   'A-04', '/images/products/14_Penggaris_30cm.webp'),
        ('STA', 'STA-005', 'Drawing Pen 0.1 mm', 'Drawing pen pigment ink tahan air ukuran 0.1 mm.',                   18000.00::NUMERIC(14, 2),  15, 35, 'PCS',   'A-05', '/images/products/15_Drawing_Pen_0.1mm.webp'),

        -- Kategori OFF : Office Supplies
        ('OFF', 'OFF-001', 'Sticky Notes',       'Kertas memo tempel warna pastel 76x76 mm (100 lembar/pack).',        12000.00::NUMERIC(14, 2),  10, 20, 'PACK',  'B-01', '/images/products/06_Sticky_Notes.webp'),
        ('OFF', 'OFF-002', 'Stapler',            'Stapler kantor standar kompatibel isi staples No. 10.',              28000.00::NUMERIC(14, 2),  10, 20, 'UNIT',  'B-02', '/images/products/08_Stapler.webp'),
        ('OFF', 'OFF-003', 'Paper Clip',         'Klip kertas logam anti karat ukuran standar (100 pcs/box).',          9000.00::NUMERIC(14, 2),  15, 30, 'BOX',   'B-03', '/images/products/07_Paper_Clip.webp'),
        ('OFF', 'OFF-004', 'Folder Dokumen',     'Map dokumen plastik transparan ukuran folio/A4.',                    14500.00::NUMERIC(14, 2),  12, 25, 'PACK',  'B-04', '/images/products/09_Folder_Dokumen.webp'),
        ('OFF', 'OFF-005', 'Binder Clip',        'Penjepit kertas binder clip ukuran sedang 32 mm (12 pcs/box).',       16000.00::NUMERIC(14, 2),  15, 30, 'BOX',   'B-05', '/images/products/10_Binder_Clip.webp'),

        -- Kategori ART : Art Supplies
        ('ART', 'ART-001', 'Sketchbook A4',      'Buku sketsa A4 kertas 150 gsm isi 50 lembar.',                       42000.00::NUMERIC(14, 2),  10, 20, 'PCS',   'C-01', '/images/products/01_Sketchbook_A4.webp'),
        ('ART', 'ART-002', 'Watercolor Set',     'Set cat air 12 warna solid lengkap dengan kuas mini.',               65000.00::NUMERIC(14, 2),   5, 15, 'SET',   'C-02', '/images/products/02_Watercolor_Set.webp'),
        ('ART', 'ART-003', 'Acrylic Paint',      'Cat akrilik cepat kering kemasan botol 100 ml.',                     24000.00::NUMERIC(14, 2),   5, 15, 'BOTOL', 'C-03', '/images/products/03_Acrylic_Paint.webp'),
        ('ART', 'ART-004', 'Kuas Lukis',         'Set kuas lukis bulu sintetis berbagai ukuran (6 pcs/set).',          35000.00::NUMERIC(14, 2),   5, 12, 'SET',   'C-04', '/images/products/04_Kuas_Lukis.webp'),
        ('ART', 'ART-005', 'Canvas Panel',       'Kanvas lukis panel katun ukuran 30x40 cm siap pakai.',               32000.00::NUMERIC(14, 2),   4,  8, 'PCS',   'C-05', '/images/products/05_Canvas_Panel.webp')
) AS v(category_code, sku, name, description, purchase_price, minimum_stock, low_stock_threshold, unit, rack_location, image_path)
INNER JOIN categories c
    ON c.code = v.category_code
ON CONFLICT (sku) DO NOTHING;

COMMIT;
