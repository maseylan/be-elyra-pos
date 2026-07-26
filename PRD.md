# PRD — PoS System (Backend)

## 1. Overview

**Scope:** Backend API untuk platform PoS **SaaS multi-tenant** — melayani frontend PoS (web, sudah dibuat di `PRD-POS-Frontend.md`). Satu platform ini melayani banyak bisnis berbeda (tenant), masing-masing dengan banyak outlet, mendukung mode bisnis **retail** dan **F&B**, dengan kebutuhan utama menangani **sinkronisasi transaksi offline** dari device kasir.

**Tanggung jawab backend:**
- Isolasi data antar tenant (bisnis) secara aman — satu tenant tidak boleh bisa mengakses data tenant lain sama sekali
- Sumber kebenaran (source of truth) untuk katalog produk, stok, harga, dan data master lain per tenant
- Menerima dan memproses transaksi — termasuk batch transaksi yang di-replay dari device yang sempat offline
- Integrasi payment gateway (QRIS, e-wallet, kartu)
- Reporting dan audit trail per tenant

**Catatan scope:** Modul billing/subscription (langganan, invoice, trial) **belum termasuk** di PRD ini — fokus dulu ke arsitektur multi-tenant teknis. Billing dibahas di PRD terpisah menyusul.

---

## 2. Tech stack (backend)

| Layer | Pilihan | Catatan |
|---|---|---|
| Runtime | Node.js | — |
| Framework | Express.js + TypeScript | Konsisten dengan stack HRM system & Rongawi AI kamu |
| Database | PostgreSQL | Integritas data finansial (`numeric` native), relasi antar entitas, reporting agregasi |
| Connection pooling | PgBouncer (transaction pooling mode) | Memultiplex pool-per-tenant di sisi aplikasi jadi koneksi fisik terkendali di sisi database |
| ORM | **Drizzle ORM** | Dipilih dibanding Prisma khusus karena kebutuhan schema-per-tenant — lihat bagian 4.0 |
| Multi-tenancy | Schema-per-tenant (satu database PostgreSQL, tiap tenant punya schema sendiri) | Lihat bagian 4.0 |
| Realtime | Socket.io | Update stok live, status meja, notifikasi ke kitchen display — di-scope per tenant room |
| Auth | JWT (access + refresh token) | PIN-based untuk kasir, email/password untuk admin/owner, terpisah dari auth SuperAdmin platform |
| Caching / rate limit | Redis | Cache katalog untuk sync cepat, rate limiting per device |
| Payment gateway | Midtrans atau Xendit *(pilih salah satu — lihat open question)* | Mendukung QRIS, e-wallet, kartu — umum dipakai di Indonesia |
| File storage | Cloudinary / S3 (opsional) | Untuk gambar produk |

---

## 3. Arsitektur tingkat tinggi

- **REST API** untuk operasi CRUD dan transaksi, **WebSocket (Socket.io)** untuk update realtime (stok, status meja, notifikasi dapur)
- **Tenant resolution middleware** — jalan di awal setiap request, menentukan tenant mana yang sedang diakses (dari subdomain, header, atau JWT claim), sebelum request diteruskan ke controller manapun
- **Service layer** terpisah dari controller/route — controller cuma handle request/response, business logic ada di `/services`, mengikuti konvensi yang sama dengan project HRM kamu
- **Drizzle query builder** diakses hanya dari service layer/repository, tidak langsung dari controller
- Modular per domain: `platform` (super admin & tenant registry), `auth`, `outlet`, `product`, `order`, `payment`, `sync`, `report`

---

## 4.0 Arsitektur multi-tenant (schema-per-tenant dengan Drizzle)

Ini bagian paling kritis dari PRD ini karena mempengaruhi hampir semua modul lain.

**Struktur database:**
- Satu **shared/public schema** — isinya cuma tenant registry (`Tenant`, `SuperAdmin`) dan hal-hal platform-level, bukan data bisnis
- Tiap tenant punya **schema sendiri** (contoh: `tenant_abc123`) yang isinya identik strukturnya (`Outlet`, `Product`, `Order`, dst — sama seperti data model di bagian 5), tapi datanya terpisah total secara fisik di level database

**Kenapa Drizzle, bukan Prisma, untuk kasus ini — [DIPUTUSKAN]:**
Prisma butuh code-generation step yang terikat ke satu koneksi/schema per `PrismaClient`, sehingga schema-per-tenant terpaksa pakai pola "satu client di-cache per tenant" — yang berujung ke connection pool meledak kalau tenant-nya banyak (tiap client bawa pool sendiri). Drizzle berbeda: definisi tabelnya cuma objek TypeScript biasa, tanpa build step yang terikat koneksi, sehingga bisa **dibuat ulang secara dinamis saat runtime** dengan schema target yang berbeda-beda.

**Pola implementasi — pool-per-tenant dengan PgBouncer di depan Postgres — [DIPUTUSKAN]:**
- Tiap tenant punya `pg.Pool` sendiri (bukan berbagi satu pool) — pool size kecil per tenant (contoh: 3-5 koneksi), supaya total tetap terkendali
- **LRU pool cache**: cuma pool tenant yang aktif (misal 50-100 tenant paling sering diakses) yang tetap terbuka; pool tenant yang idle dalam periode tertentu (contoh: 15 menit) otomatis ditutup dan dibuat ulang on-demand pas ada request masuk lagi
- **PgBouncer** dipasang di depan PostgreSQL (mode *transaction pooling*) — memultiplex banyak pool logis dari sisi aplikasi jadi jumlah koneksi fisik yang jauh lebih sedikit di sisi database, supaya jumlah tenant aktif nggak langsung proporsional ke jumlah koneksi fisik ke Postgres
- Trade-off yang diterima: tenant yang jarang aktif kena sedikit cold-start latency (pool dibikin ulang) pas request pertama setelah idle lama

**Kenapa ini dipilih dibanding single pool:**
- Isolasi data jadi **fisik** (tiap tenant benar-benar pakai koneksi/pool sendiri, dengan `search_path`/schema context yang terikat ke pool itu) — bukan lagi bergantung ke kebenaran kode aplikasi buat milih tabel yang tepat
- Noisy neighbor hilang — tenant yang sibuk cuma menghabiskan koneksi di pool-nya sendiri, nggak mempengaruhi tenant lain
- Tetap terkendali di sisi database berkat PgBouncer, tidak seperti pola pool-per-tenant polos yang connection count-nya meledak linear sesuai jumlah tenant

**Kenapa Drizzle tetap dipilih dibanding Prisma meski sekarang pool-per-tenant:**
Drizzle `pg.Pool` jauh lebih ringan dibanding `PrismaClient` instance (tidak ada generated binary/runtime besar per instance), jadi overhead memori per tenant yang aktif tetap jauh lebih kecil dibanding kalau pakai Prisma dengan pola yang sama.

**Mitigasi tambahan wajib — routing ke pool yang benar:**
Isolasi fisik ini tetap bergantung pada satu titik: kode yang memilih *pool mana* yang dipakai untuk request tertentu (`getPoolForTenant(tenantId)`). Pakai **`AsyncLocalStorage`** untuk menyimpan `tenantId` per-request secara aman (bukan variable biasa yang berisiko ke-share antar request async yang berjalan bersamaan), supaya pool-routing ini terpusat di satu tempat yang gampang diuji, bukan tersebar di banyak titik kode.

**Struktur schema Drizzle:**
- Satu file `schema.ts` untuk definisi tabel platform (`tenants`, `super_admins`) — statis, selalu di `public` schema
- Satu factory/template definisi tabel tenant (`products`, `orders`, `outlets`, dst) — dipakai bersama semua pool tenant, karena strukturnya identik, cuma koneksi/pool-nya yang beda per tenant

**Tenant resolution di local development — [DIPUTUSKAN]: `x-tenant-id` header sebagai fallback**
- Production: resolve tenant dari subdomain
- Non-production (dev/test): fallback ke header `x-tenant-id` kalau subdomain nggak tersedia (memudahkan testing lewat Postman/local)
- ⚠️ **Wajib dikunci di belakang pengecekan `NODE_ENV !== 'production'`** — header ini tidak boleh pernah dipercaya di production, karena siapa pun bisa spoof tenant lain cuma dengan ganti header manual

**Migration lintas-tenant:**
- Migration digenerate lewat `drizzle-kit generate` dari `schema.ts` → menghasilkan file SQL mentah
- Tetap butuh **custom orchestration script**: loop semua tenant aktif dari tabel `Tenant` di shared schema, jalankan SQL migration itu ke tiap schema tenant satu-satu
- Karena file migration Drizzle berupa SQL polos (bukan format yang terikat ke satu schema context seperti Prisma), lebih mudah di-parameterize nama schema-nya secara manual saat script orchestration jalan

**Tenant provisioning (saat ada bisnis baru daftar):**
1. Insert record baru ke tabel `Tenant` di shared schema
2. Buat schema PostgreSQL baru untuk tenant tsb (`CREATE SCHEMA tenant_xxx`)
3. Jalankan migration SQL (hasil `drizzle-kit generate`) terhadap schema baru itu lewat script orchestration
4. Seed data default (kategori default, role default, dsb)
5. Return kredensial awal / link setup ke pemilik bisnis

**Super Admin (platform-level):**
- Role terpisah total dari role tenant (`cashier`/`supervisor`/`admin`/`owner`) — SuperAdmin hidup di shared schema, bisa lihat daftar tenant tapi **tidak otomatis** bisa masuk ke data bisnis tenant manapun tanpa mekanisme impersonation eksplisit (untuk kebutuhan support)

---

## 4. Core modules

### 4.1 Auth & user management
- Login PIN (kasir, 4-6 digit, di-hash) dan login email/password (admin/owner) — **scoped ke tenant schema masing-masing**
- Role tenant: `cashier`, `supervisor`, `admin`, `owner`
- Role platform (terpisah): `super_admin` — auth-nya beda jalur dari auth tenant
- JWT access token (short-lived) + refresh token dengan rotation, **JWT tenant menyimpan `tenantId` sebagai claim**
- Endpoint approval PIN terpisah untuk aksi sensitif (void, refund, diskon manual)

### 4.2 Outlet & device management
- CRUD outlet **dalam schema tenant yang bersangkutan** (satu tenant tetap bisa punya banyak outlet, filtering `outlet_id` seperti rencana awal — cuma sekarang berada di dalam lapisan isolasi tenant, bukan lapisan terluar)
- Device pairing — device ID terdaftar dan terikat ke outlet tertentu **dan** tenant tertentu
- Config `businessMode` (`retail`/`fnb`) disimpan per outlet, diambil frontend saat device pairing

### 4.3 Produk & katalog
- CRUD produk, kategori, varian (retail), modifier/add-on (F&B) — semua dalam schema tenant
- Manajemen stok dengan auto-deduct saat transaksi berhasil
- Endpoint **delta sync** — frontend cuma minta perubahan sejak `lastSyncedAt`, bukan seluruh katalog tiap kali, biar hemat bandwidth pas reconnect

### 4.4 Meja (mode F&B)
- CRUD layout & status meja, broadcast perubahan status via socket — **socket room di-scope per tenant+outlet**, supaya event satu tenant nggak bocor ke tenant lain
- Order per meja (multi-round), endpoint merge/split meja

### 4.5 Order & transaksi
- Endpoint create order/transaksi **wajib pakai idempotency key** — krusial karena transaksi offline bisa ke-retry saat sync, dan tanpa idempotency key ini bisa duplikat
- Validasi stok saat create (retail), validasi kombinasi modifier (F&B)
- Write order + deduct stok dilakukan dalam satu **Drizzle transaction** (`db.transaction(async (tx) => {...})`) supaya atomic — kalau salah satu gagal, semuanya rollback
- Dukungan split bill dan split payment di level data model
- Void/refund dengan audit trail (siapa approve, kapan, alasan)

### 4.6 Payment
- Integrasi payment gateway untuk QRIS, e-wallet, kartu
- Webhook handler untuk konfirmasi pembayaran async — **signature webhook wajib diverifikasi**, dan payload webhook harus bisa dipetakan balik ke tenant+order yang benar
- Endpoint reconciliation — cocokkan status transaksi lokal vs status di payment gateway

### 4.7 Offline sync engine
- Endpoint **batch sync**: terima array transaksi dari device, proses satu per satu dengan idempotency key masing-masing, **dalam konteks schema tenant device tsb**
- Idempotency key diberi **unique constraint** di level tabel Drizzle tenant — percobaan insert dengan key yang sama otomatis ditolak database, bukan cuma dicek manual di application layer
- Response per transaksi dikembalikan sebagai status individual (`success` / `conflict` / `error`), bukan all-or-nothing, supaya device tau transaksi mana yang perlu di-retry
- Mapping local ID (dibuat device saat offline) ke server ID setelah sync berhasil

### 4.8 Shift & cash management
- Endpoint buka/tutup shift — simpan opening balance, closing balance
- Kalkulasi otomatis expected cash (dari transaksi tunai) vs actual cash yang diinput kasir
- Laporan ringkas per shift

### 4.9 Reporting
- Endpoint ringkasan penjualan (harian, per shift, per outlet, per kasir) — semua di dalam scope satu tenant
- Export laporan (CSV/PDF) — bisa jadi modul terpisah kalau kompleksitasnya besar

### 4.10 Notifikasi realtime
- Notifikasi order baru ke kitchen display (F&B) via socket
- Notifikasi low stock ke admin (retail)

### 4.11 Tenant management (platform-level)
- Endpoint registrasi tenant baru (trigger provisioning di bagian 4.0)
- CRUD tenant oleh SuperAdmin (lihat daftar tenant, status aktif/nonaktif, detail penggunaan)
- Suspend/reactivate tenant (tanpa billing dulu — kontrol manual oleh SuperAdmin untuk sekarang)
- Assign subdomain/slug unik per tenant saat registrasi

---

## 5. Data model (high-level)

**Shared schema:** `Tenant`, `SuperAdmin`

**Tiap tenant schema:** `User`, `Outlet`, `Device`, `Product`, `Category`, `Variant`, `Modifier`, `Table`, `Order`, `OrderItem`, `Payment`, `Shift`, `AuditLog`

Didefinisikan sebagai tabel Drizzle di `schema.ts`, dengan relasi eksplisit lewat foreign key (contoh: `Order` punya banyak `OrderItem`, `OrderItem` merujuk ke `Product`). Definisi tabel tenant dibuat generik lewat factory function yang di-parameterize nama schema-nya saat runtime (lihat bagian 4.0). Field harga/uang pakai tipe `numeric`, bukan `float`/`real`, untuk presisi eksak.

*(Detail kolom per tabel belum dibahas di PRD ini — masuk ke tahap technical design terpisah, termasuk strategi migration lintas-tenant dengan `drizzle-kit`.)*

---

## 6. Non-functional requirements

- **Idempotency wajib** di semua endpoint yang berpotensi di-retry dari sync offline
- Response time API < 200ms untuk endpoint CRUD umum (di luar payment gateway roundtrip)
- Audit log untuk semua aksi sensitif: void, refund, diskon manual, perubahan harga
- Rate limiting per device/IP menggunakan Redis
- Semua timestamp disimpan UTC, konversi timezone dilakukan di frontend
- **Isolasi tenant harus terbukti dari level database**, bukan cuma dicek di application layer — kebocoran data antar tenant dianggap security incident kritis
- Skalabilitas schema-per-tenant punya batas praktis di PostgreSQL (ribuan schema masih wajar, puluhan ribu mulai berat) — perlu dipantau seiring pertumbuhan jumlah tenant
- Monitoring wajib untuk: jumlah pool aktif (LRU cache), utilisasi koneksi PgBouncer, dan cold-start latency tenant yang baru diaktifkan kembali dari idle

---

## 7. Security

- JWT access token short expiry (contoh: 15 menit) + refresh token rotation
- PIN kasir di-hash dengan bcrypt, tidak pernah disimpan plaintext
- Role-based access control (RBAC) diverifikasi di setiap endpoint sensitif, bukan cuma di frontend
- HTTPS wajib di semua environment
- Webhook payment gateway diverifikasi signature-nya sebelum diproses
- **Tenant resolution middleware wajib jalan sebelum middleware lain** — request tanpa tenant context yang valid harus ditolak di awal, bukan diteruskan dengan asumsi default
- Auth SuperAdmin **sepenuhnya terpisah** dari auth tenant (endpoint, token, bahkan idealnya subdomain berbeda seperti `admin.pos-app.com`)
- Isolasi data dijamin secara fisik lewat pool-per-tenant — tapi tetap wajib ada test yang memverifikasi fungsi `getPoolForTenant(tenantId)` selalu me-resolve ke pool yang benar, karena ini satu-satunya titik yang menentukan isolasi tersebut berjalan sesuai rencana

---

## 8. Out of scope

- Frontend web/mobile (dibahas di PRD terpisah)
- Modul billing/subscription tenant (menyusul di PRD terpisah)
- Modul payroll/HR (sistem berbeda dari HRM yang sudah kamu punya)
- Inventory forecasting berbasis AI/prediksi restock otomatis

---

## 9. Asumsi & open questions

- [x] ~~Database: MongoDB vs PostgreSQL~~ → **Diputuskan: PostgreSQL**
- [x] ~~Multi-outlet: single schema row-level vs terpisah~~ → **Diputuskan: multi-tenant schema-per-tenant**, outlet tetap row-level filtering *di dalam* tiap schema tenant
- [x] ~~ORM: Prisma vs alternatif~~ → **Diputuskan: Drizzle ORM**
- [x] ~~Pola connection pooling~~ → **Diputuskan: pool-per-tenant + LRU cache + PgBouncer**, isolasi data di level infrastruktur
- [x] ~~Subdomain di local dev~~ → **Diputuskan: fallback `x-tenant-id` header**, dikunci di non-production saja
- [ ] **Payment gateway:** Midtrans atau Xendit — belum diputuskan
- [ ] Offline transaction window untuk batch sync — belum diputuskan (1/3/7 hari)
- [ ] Hosting PostgreSQL: managed service (Supabase/Neon/RDS) atau self-hosted? Perlu dipastikan support PgBouncer atau setara (beberapa managed service sudah punya pooler built-in)
- [ ] Mekanisme tenant provisioning — self-serve signup otomatis, atau manual approval oleh SuperAdmin dulu di tahap awal?
- [ ] Custom domain per tenant (bukan cuma subdomain) — perlu di-support dari awal atau nanti?
- [ ] Ukuran pool per tenant dan batas LRU cache (berapa tenant aktif maksimal yang pool-nya tetap terbuka) — perlu di-benchmark, bukan cuma tebak-tebakan angka
- [ ] Siapa yang menulis test isolasi tenant (`getPoolForTenant`), dan di fase development mana ini harus sudah ada?