import { publicDb } from './src/db/poolManager';
import { subscriptionPlans } from './src/db/schema';

const plans = [
  {
    id: 'starter', name: 'Starter', priceMonthly: 0, priceYearly: null,
    features: [
      '1 Outlet & 3 Akun Karyawan (include)',
      'Maks 100 Produk',
      'Manajemen Produk & Kategori',
      'Varian Produk',
      'POS Kasir (Menu Grid, Cart, Checkout)',
      'Multi Metode Pembayaran',
      'Pembulatan Otomatis',
      'Pajak Inklusif/Eksklusif',
      'Cetak Struk',
      'Manajemen Pelanggan',
      'Riwayat Pembelian Pelanggan',
      'Manajemen Stok & Mutasi',
      'Peringatan Stok Menipis',
      'Transaksi & Riwayat Penjualan',
      'Laporan Penjualan Harian',
      'Refund Pesanan',
      'Portal Tagihan Pemilik',
      'Support Standar',
    ],
    maxOutlets: 1, maxProducts: 100, maxAccounts: 3, hasLoyalty: false,
    sortOrder: 1, isActive: true,
  },
  {
    id: 'pro', name: 'Pro', priceMonthly: 99000, priceYearly: 990000,
    features: [
      '1 Outlet & 10 Akun Karyawan (include)',
      'Unlimited Produk',
      'Semua fitur Starter',
      'Outlet Settings Override',
      'Loyalty Program (Poin + Reward)',
      'Kupon Diskon',
      'Laporan Penjualan Lanjutan',
      'Prioritas Support',
    ],
    maxOutlets: 1, maxProducts: null, maxAccounts: 10, hasLoyalty: true,
    sortOrder: 2, isActive: true,
  },
  {
    id: 'enterprise', name: 'Enterprise', priceMonthly: 0, priceYearly: null,
    features: [
      'Unlimited Outlet & Akun Karyawan',
      'Unlimited Produk',
      'Semua fitur Pro',
      'Akses API',
      'Dedicated Account Manager',
      'SLA 99.9%',
      'On-Premise Opsional',
    ],
    maxOutlets: null, maxProducts: null, maxAccounts: null, hasLoyalty: true,
    sortOrder: 3, isActive: true,
  },
];

async function seed() {
  for (const plan of plans) {
    await publicDb.insert(subscriptionPlans).values(plan).onConflictDoUpdate({
      target: subscriptionPlans.id,
      set: plan,
    });
    console.log(`Seeded plan: ${plan.id}`);
  }
  console.log('All plans seeded');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
