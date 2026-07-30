import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

import {
  users, categories, products, outlets, userOutlets, tenantSettings, outletSettings,
  addOns, productAddOns, outletAddOns, outletProducts, stockMovements,
  modifierGroups as mg, modifiers as mods, outletModifiers,
  floorPlans, tables as restTables,
  customers, cashierSessions, orders, orderItems, refreshTokens,
} from '../db/tenant_schema';

dotenv.config();

const TID = 'tenant_1785251589717_u8m8r';
const BATCH = 100;

function tenantDbUrl(): string {
  const u = process.env.DATABASE_URL;
  if (!u) throw new Error('DATABASE_URL not set');
  const url = new URL(u);
  url.pathname = `/${TID}`;
  return url.toString();
}

// ── DATA ──────────────────────────────────────────────────────────

const userData = [
  { role: 'owner', name: 'Budi Santoso', email: 'budi@warung.id' },
  { role: 'admin', name: 'Siti Rahmawati', email: 'siti@warung.id' },
  { role: 'supervisor', name: 'Ahmad Fauzi', email: 'ahmad@warung.id' },
  { role: 'cashier', name: 'Dewi Lestari' },
  { role: 'cashier', name: 'Rudi Hartono' },
  { role: 'cashier', name: 'Mega Wijaya' },
  { role: 'cashier', name: 'Fitriani Putri' },
  { role: 'cashier', name: 'Hendra Gunawan' },
  { role: 'cashier', name: 'Ratna Sari' },
  { role: 'cashier', name: 'Dimas Ardiansyah' },
];

const outletData = [
  { name: 'Outlet Pusat', code: 'PST', businessMode: 'fnb', address: 'Jl. Merdeka No. 1, Jakarta', phone: '021-12345678' },
  { name: 'Outlet Cabang', code: 'CBG', businessMode: 'fnb', address: 'Jl. Sudirman No. 10, Bandung', phone: '022-87654321' },
  { name: 'Outlet Ekspres', code: 'EXP', businessMode: 'retail', address: 'Jl. Gatot Subroto No. 5, Surabaya', phone: '031-55555555' },
  { name: 'Outlet Kuta', code: 'KTA', businessMode: 'fnb', address: 'Jl. Pantai Kuta No. 15, Bali', phone: '0361-1234567' },
  { name: 'Outlet Malioboro', code: 'MLB', businessMode: 'retail', address: 'Jl. Malioboro No. 25, Yogyakarta', phone: '0274-9876543' },
];

const catData = [
  'Makanan Pembuka','Makanan Utama','Nasi','Mie & Pasta','Ayam','Ikan','Seafood','Daging Sapi',
  'Sayuran','Sup','Sate','Bakar & Panggang','Cemilan','Gorengan','Roti & Bakery','Dessert',
  'Minuman Panas','Kopi','Minuman Dingin','Jus & Smoothie',
];

const prodData: { cat: number; name: string; cost: number; sell: number }[] = [
  // Makanan Pembuka
  ...[
    ['Lumpia Semarang',12,18],['Spring Roll Udang',10,15],['Siomay Bandung',8,12],
    ['Batagor',10,15],['Cireng Isi Ayam',8,12],
  ].map(([n,c,s]) => ({cat:0,name:n as string,cost:c as number,sell:s as number})),
  // Makanan Utama
  ...[
    ['Nasi Goreng Spesial',20,35],['Nasi Goreng Seafood',25,40],['Nasi Goreng Kampung',15,28],
    ['Nasi Goreng Merah',18,30],['Nasi Goreng Hitam',20,32],
  ].map(([n,c,s]) => ({cat:1,name:n as string,cost:c as number,sell:s as number})),
  // Nasi
  ...[
    ['Nasi Putih',3,5],['Nasi Merah',4,7],['Nasi Gurih',5,8],
    ['Nasi Liwet Solo',20,35],['Nasi Megono',15,25],
  ].map(([n,c,s]) => ({cat:2,name:n as string,cost:c as number,sell:s as number})),
  // Mie & Pasta
  ...[
    ['Mie Ayam Original',12,20],['Mie Ayam Bakso',15,25],['Mie Ayam Ceker',15,25],
    ['Mie Ayam Komplit',18,30],['Mie Goreng Jawa',12,20],
  ].map(([n,c,s]) => ({cat:3,name:n as string,cost:c as number,sell:s as number})),
  // Ayam
  ...[
    ['Ayam Goreng Biasa',15,25],['Ayam Goreng Kremes',18,28],['Ayam Bakar Taliwang',18,30],
    ['Ayam Bakar Madu',20,32],['Ayam Panggang',20,35],
  ].map(([n,c,s]) => ({cat:4,name:n as string,cost:c as number,sell:s as number})),
  // Ikan
  ...[
    ['Ikan Bakar Tepi',25,40],['Ikan Goreng Tepi',20,35],['Ikan Nila Bakar',22,38],
    ['Gurame Goreng',30,50],['Gurame Bakar',35,55],
  ].map(([n,c,s]) => ({cat:5,name:n as string,cost:c as number,sell:s as number})),
  // Seafood
  ...[
    ['Udang Goreng Tepung',25,40],['Udang Bakar Madu',30,50],['Cumi Goreng Tepung',22,38],
    ['Cumi Bakar Isi',28,45],['Cumi Rica-Rica',25,42],
  ].map(([n,c,s]) => ({cat:6,name:n as string,cost:c as number,sell:s as number})),
  // Daging Sapi
  ...[
    ['Rendang Sapi',30,50],['Sapi Lada Hitam',28,45],['Sapi Teriyaki',25,42],
    ['Steak Sapi',45,75],['Rawon',20,35],
  ].map(([n,c,s]) => ({cat:7,name:n as string,cost:c as number,sell:s as number})),
  // Sayuran
  ...[
    ['Capcay Kuah',15,25],['Capcay Seafood',22,35],['Kangkung Belacan',12,20],
    ['Kangkung Cah Bawang',10,18],['Sayur Asem',10,15],
  ].map(([n,c,s]) => ({cat:8,name:n as string,cost:c as number,sell:s as number})),
  // Sup
  ...[
    ['Sop Ayam',12,20],['Sop Iga Sapi',25,42],['Sop Sayuran',10,18],
    ['Sop Kambing',25,42],['Sop Buntut',30,50],
  ].map(([n,c,s]) => ({cat:9,name:n as string,cost:c as number,sell:s as number})),
  // Sate
  ...[
    ['Sate Ayam',18,30],['Sate Kambing',25,42],['Sate Sapi',25,40],
    ['Sate Lilit Bali',22,35],['Sate Padang',20,35],
  ].map(([n,c,s]) => ({cat:10,name:n as string,cost:c as number,sell:s as number})),
  // Bakar & Panggang
  ...[
    ['Ayam Bakar Taliwang',22,38],['Ayam Bakar Padang',20,35],['Iga Bakar Madu',35,55],
    ['Gurame Bakar Pesmol',30,50],['Udang Bakar Madu',28,45],
  ].map(([n,c,s]) => ({cat:11,name:n as string,cost:c as number,sell:s as number})),
  // Cemilan
  ...[
    ['Keripik Singkong Balado',8,12],['Keripik Pisang Manis',8,12],['Makaroni Keju Panggang',10,15],
    ['Kentang Goreng Keju',10,18],['Onion Ring',10,18],
  ].map(([n,c,s]) => ({cat:12,name:n as string,cost:c as number,sell:s as number})),
  // Gorengan
  ...[
    ['Tahu Goreng',5,8],['Tempe Goreng',4,7],['Pisang Goreng',6,10],
    ['Singkong Goreng',6,10],['Bakwan Sayur',5,8],
  ].map(([n,c,s]) => ({cat:13,name:n as string,cost:c as number,sell:s as number})),
  // Roti & Bakery
  ...[
    ['Roti Bakar Coklat',10,18],['Roti Bakar Keju',10,18],['Roti Bakar Pisang Keju',12,20],
    ['Sandwich Ayam Mayo',15,25],['Sandwich Tuna',15,25],
  ].map(([n,c,s]) => ({cat:14,name:n as string,cost:c as number,sell:s as number})),
  // Dessert
  ...[
    ['Es Krim Vanilla',8,15],['Es Krim Coklat',8,15],['Es Krim Stroberi',8,15],
    ['Pudding Coklat Vla',10,18],['Pudding Buah Segar',12,20],
  ].map(([n,c,s]) => ({cat:15,name:n as string,cost:c as number,sell:s as number})),
  // Minuman Panas
  ...[
    ['Teh Tawar Hangat',3,5],['Teh Manis Hangat',4,7],['Teh Jahe Hangat',6,10],
    ['Wedang Ronde',10,18],['Wedang Uwuh',12,20],
  ].map(([n,c,s]) => ({cat:16,name:n as string,cost:c as number,sell:s as number})),
  // Kopi
  ...[
    ['Kopi Hitam',5,10],['Kopi Susu',8,15],['Kopi Gula Aren',12,20],
    ['Cappuccino',15,25],['Cafe Latte',18,28],
  ].map(([n,c,s]) => ({cat:17,name:n as string,cost:c as number,sell:s as number})),
  // Minuman Dingin
  ...[
    ['Es Teh Manis',4,7],['Es Teh Tawar',3,5],['Es Jeruk',6,10],
    ['Es Lemon Tea',8,12],['Es Susu Coklat',7,12],
  ].map(([n,c,s]) => ({cat:18,name:n as string,cost:c as number,sell:s as number})),
  // Jus & Smoothie
  ...[
    ['Jus Alpukat',12,20],['Jus Mangga',10,18],['Jus Jeruk Segar',10,18],
    ['Jus Jambu Merah',10,18],['Jus Stroberi',12,20],
  ].map(([n,c,s]) => ({cat:19,name:n as string,cost:c as number,sell:s as number})),
];

const addOnNames = [
  ['Extra Sambal',2000],['Extra Kecap',1000],['Saus Sambal',1000],['Saus Tomat',1000],
  ['Mayonaise',2000],['Thousand Island',2000],['Tartar Sauce',2000],['Keju Parut',3000],
  ['Bawang Goreng',1000],['Selada Segar',1000],['Irisan Timun',1000],['Irisan Tomat',1000],
  ['Acar Mentah',1000],['Kerupuk Udang',2000],['Emping Melinjo',2000],['Rempeyek Kacang',1500],
  ['Nasi Putih Ekstra',4000],['Nasi Merah Ekstra',5000],['Kentang Goreng',8000],['Coleslaw',3000],
  ['Extra Daging Ayam',10000],['Extra Daging Sapi',15000],['Extra Udang',12000],['Extra Tofu',5000],
  ['Extra Tempe',4000],['Telur Dadar',5000],['Telur Ceplok',5000],['Telur Rebus',4000],
  ['Keju Mozzarella',8000],['Smoked Beef',10000],['Sosis Ayam',7000],['Chicken Nugget',8000],
  ['Boba Pearl',5000],['Jelly',3000],['Nata De Coco',3000],['Grass Jelly',3000],
  ['Susu Segar',5000],['Susu Almond',7000],['Susu Kedelai',5000],
  ['Gula Aren Cair',3000],['Gula Batu',2000],['Sirup Vanila',3000],['Sirup Karamel',3000],
  ['Sirup Hazelnut',3000],['Whipped Cream',4000],['Ice Cream Vanilla',6000],
  ['Choco Chips',3000],['Oreo Crumb',3000],['Extra Matcha',5000],
  ['Saus Keju',5000],
];

const modGroupData = [
  { name: 'Level Pedas', sel: 'single', min: 1, max: 1, req: true },
  { name: 'Pilihan Topping', sel: 'multiple', min: 0, max: 3, req: false },
  { name: 'Ukuran Minuman', sel: 'single', min: 1, max: 1, req: true },
  { name: 'Tingkat Kematangan', sel: 'single', min: 1, max: 1, req: true },
  { name: 'Saus Tambahan', sel: 'multiple', min: 0, max: 2, req: false },
  { name: 'Pilihan Es', sel: 'single', min: 0, max: 1, req: false },
  { name: 'Pilihan Gula', sel: 'single', min: 1, max: 1, req: true },
  { name: 'Variasi Nasi', sel: 'single', min: 1, max: 1, req: true },
  { name: 'Tambahan Protein', sel: 'multiple', min: 0, max: 2, req: false },
  { name: 'Suhu Minuman', sel: 'single', min: 1, max: 1, req: true },
  { name: 'Creamer Options', sel: 'single', min: 1, max: 1, req: true },
  { name: 'Campuran Kopi', sel: 'single', min: 0, max: 1, req: false },
  { name: 'Ukuran Roti', sel: 'single', min: 1, max: 1, req: true },
  { name: 'Selai Olesan', sel: 'multiple', min: 0, max: 2, req: false },
  { name: 'Pilihan Lauk', sel: 'multiple', min: 0, max: 3, req: false },
  { name: 'Kekentalan Jus', sel: 'single', min: 1, max: 1, req: true },
  { name: 'Tambahan Susu', sel: 'single', min: 0, max: 1, req: false },
  { name: 'Pilihan Toping Dessert', sel: 'multiple', min: 0, max: 2, req: false },
  { name: 'Ekstra Sayur', sel: 'multiple', min: 0, max: 2, req: false },
  { name: 'Pilihan Sambal', sel: 'single', min: 1, max: 1, req: true },
];

const modItemData: { g: number; name: string; price: number }[] = [
  {g:0,name:'Tidak Pedas',price:0},{g:0,name:'Pedas Sedang',price:0},{g:0,name:'Pedas Banget',price:0},
  {g:1,name:'Telur',price:5000},{g:1,name:'Keju',price:7000},{g:1,name:'Ayam Suwir',price:10000},
  {g:2,name:'Small',price:0},{g:2,name:'Medium',price:0},{g:2,name:'Large',price:3000},
  {g:3,name:'Medium Rare',price:0},{g:3,name:'Well Done',price:0},{g:3,name:'Extra Well',price:0},
  {g:4,name:'Sambal Matah',price:2000},{g:4,name:'Sambal Kecap',price:0},{g:4,name:'Sambal Dabu-Dabu',price:2000},
  {g:5,name:'Es Biasa',price:0},{g:5,name:'Es Batu Banyak',price:0},{g:5,name:'Tanpa Es',price:0},
  {g:6,name:'Less Sugar',price:0},{g:6,name:'Normal Sugar',price:0},{g:6,name:'Extra Sugar',price:0},
  {g:7,name:'Nasi Putih',price:0},{g:7,name:'Nasi Merah',price:2000},{g:7,name:'Nasi Gurih',price:3000},
  {g:8,name:'Telur Tambahan',price:5000},{g:8,name:'Ayam Suwir',price:10000},{g:8,name:'Tahu Tempe',price:3000},
  {g:9,name:'Hangat',price:0},{g:9,name:'Dingin',price:0},{g:9,name:'Room Temperature',price:0},
  {g:10,name:'Susu Segar',price:3000},{g:10,name:'Krimer Kental Manis',price:2000},{g:10,name:'Susu Almond',price:5000},
  {g:11,name:'Vanilla Syrup',price:3000},{g:11,name:'Caramel Syrup',price:3000},{g:11,name:'Hazelnut Syrup',price:3000},
  {g:12,name:'Roti Panggang Biasa',price:0},{g:12,name:'Roti Panggang Butter',price:2000},{g:12,name:'Roti Bakar Spesial',price:5000},
  {g:13,name:'Selai Stroberi',price:0},{g:13,name:'Selai Blueberry',price:0},{g:13,name:'Selai Nanas',price:0},
  {g:14,name:'Ayam Goreng',price:10000},{g:14,name:'Telur Balado',price:5000},{g:14,name:'Ikan Asin',price:3000},{g:14,name:'Tempe Orek',price:3000},
  {g:15,name:'Encer',price:0},{g:15,name:'Sedang',price:0},{g:15,name:'Kental',price:0},
  {g:16,name:'Susu Full Cream',price:5000},{g:16,name:'Susu Low Fat',price:5000},{g:16,name:'Susu Kedelai',price:5000},
  {g:17,name:'Choco Crunch',price:3000},{g:17,name:'Sprinkle',price:2000},{g:17,name:'Wafer Stick',price:3000},
  {g:18,name:'Tumis Buncis',price:3000},{g:18,name:'Cah Brokoli',price:4000},{g:18,name:'Kangkung',price:3000},
  {g:19,name:'Sambal Terasi',price:0},{g:19,name:'Sambal Ijo',price:0},{g:19,name:'Sambal Tomat Mentah',price:0},
];

const floorData = [
  { outletIdx: 0, name: 'Lantai 1', w: 1200, h: 800 },
  { outletIdx: 0, name: 'Lantai 2', w: 1000, h: 700 },
  { outletIdx: 1, name: 'Ruangan Utama', w: 1000, h: 700 },
  { outletIdx: 2, name: 'Area Toko', w: 800, h: 600 },
  { outletIdx: 3, name: 'Terrace', w: 900, h: 600 },
];

const tableDefs: { fi: number; num: string; cap: number }[] = [
  {fi:0,num:'T1',cap:4},{fi:0,num:'T2',cap:4},{fi:0,num:'T3',cap:6},{fi:0,num:'T4',cap:4},{fi:0,num:'T5',cap:8},{fi:0,num:'T6',cap:2},
  {fi:1,num:'L2-A',cap:4},{fi:1,num:'L2-B',cap:4},{fi:1,num:'L2-C',cap:6},{fi:1,num:'L2-D',cap:2},{fi:1,num:'L2-E',cap:4},{fi:1,num:'L2-VIP',cap:8},
  {fi:2,num:'A1',cap:4},{fi:2,num:'A2',cap:4},{fi:2,num:'A3',cap:6},{fi:2,num:'B1',cap:2},{fi:2,num:'B2',cap:2},{fi:2,num:'B3',cap:4},
  {fi:3,num:'R1',cap:2},{fi:3,num:'R2',cap:2},{fi:3,num:'R3',cap:4},{fi:3,num:'R4',cap:4},{fi:3,num:'R5',cap:6},
  {fi:4,num:'TR1',cap:4},{fi:4,num:'TR2',cap:4},{fi:4,num:'TR3',cap:6},{fi:4,num:'TR4',cap:2},{fi:4,num:'TR5',cap:2},{fi:4,num:'TR6',cap:8},
];

const firstNames = 'Andi,Budi,Cici,Dewi,Eko,Fitri,Gilang,Hesti,Indra,Joko,Kiki,Lina,Maman,Nita,Oka,Putri,Qori,Rudi,Sari,Tono,Ujang,Vina,Wawan,Yuni,Zaki,Agus,Bayu,Candra,Deni,Edi,Fajar,Gita,Heru,Irfan,Joko,Kurnia,Leo,Mega,Sandi,Nova,Adi,Dian,Yanto,Rani,Bambang,Hendra,Ari,Dodi,Rama,Yoga,Dimas,Reza,Farid,Sinta,Wulan,Andre,Bella,Citra,Doni,Eka,Fera,Galuh,Hana,Irwan,Juli,Kris,Lutfi,Mira,Nina,Oscar,Pram,Rizki,Siska,Teguh,Vera,Wahyu,Yogi'.split(',');
const lastNames = 'Pratama,Wijaya,Hidayat,Susanti,Rahmawati,Gunawan,Setiawan,Nugraha,Kusuma,Widiastuti,Permadi,Lestari,Iskandar,Anggraeni,Firmansyah,Handayani,Wibowo,Permatasari,Yuniar,Prasetyo,Santoso,Natalia,Utami,Marpaung,Siregar,Damanik,Purba,Saragih,Ginting,Tamba'.split(',');

// ── HELPERS ────────────────────────────────────────────────────────

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function pad(n: number, len: number = 5) {
  return String(n).padStart(len, '0');
}

function seqResetBase(d: Date) {
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}

// ── MAIN ──────────────────────────────────────────────────────────

async function main() {
  const url = tenantDbUrl();
  console.log(`Connecting to ${url} ...`);
  const client = new Client({ connectionString: url });
  await client.connect();
  const db = drizzle(client);

  // 0. Run pending drizzle migrations
  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: path.join(__dirname, '../../drizzle/tenant') });
  console.log('✓ Migrations applied');

  // 1. Truncate all tables
  console.log('Truncating all tables...');
  await client.query(`
    DO $$ DECLARE r RECORD; BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename!='__drizzle_migrations') LOOP
        EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);
  console.log('✓ Truncated');

  const pwHash = bcrypt.hashSync('password123', 10);
  const pinHash = bcrypt.hashSync('123456', 10);

  // 2. Users
  console.log('Seeding users...');
  const userIds: string[] = [];
  for (const u of userData) {
    const id = crypto.randomUUID();
    userIds.push(id);
  }
  for (let i = 0; i < userData.length; i += BATCH) {
    const batch = userData.slice(i, i + BATCH);
    await db.insert(users).values(batch.map((u, j) => ({
      id: userIds[i + j],
      role: u.role,
      name: u.name,
      email: u.email ?? null,
      passwordHash: pwHash,
      pinHash: u.role === 'cashier' ? pinHash : null,
      isActive: true,
      isAllOutlets: u.role === 'owner' || u.role === 'admin',
    })));
  }
  console.log(`✓ ${userIds.length} users`);

  // 3. Categories
  console.log('Seeding categories...');
  const catIds = catData.map(() => crypto.randomUUID());
  await db.insert(categories).values(catData.map((name, i) => ({
    id: catIds[i], name, description: `Kategori ${name}`,
  })));
  console.log(`✓ ${catIds.length} categories`);

  // 4. Products
  console.log('Seeding products...');
  const prodIds: string[] = [];
  for (let i = 0; i < prodData.length; i += BATCH) {
    const batch = prodData.slice(i, i + BATCH);
    const vals = batch.map((p, j) => {
      const idx = i + j;
      const id = crypto.randomUUID();
      prodIds.push(id);
      return {
        id,
        sku: `SKU-${pad(idx + 1)}`,
        name: p.name,
        costPrice: String(p.cost * 1000),
        sellPrice: String(p.sell * 1000),
        categoryId: catIds[p.cat],
        type: 'STOCK' as const,
        trackStock: true,
        unit: 'pcs',
        taxType: 'none' as const,
        isGlobal: true,
        hasVariants: false,
        isActive: true,
      };
    });
    await db.insert(products).values(vals);
  }
  console.log(`✓ ${prodIds.length} products`);

  // 5. Outlets
  console.log('Seeding outlets...');
  const outletIds = outletData.map(() => crypto.randomUUID());
  await db.insert(outlets).values(outletData.map((o, i) => ({
    id: outletIds[i], name: o.name, code: o.code,
    businessMode: o.businessMode, isActive: true,
    address: o.address, phone: o.phone,
  })));
  console.log(`✓ ${outletIds.length} outlets`);

  // 6. Tenant settings
  await db.insert(tenantSettings).values({
    id: 'default', storeName: 'Rav Resto', storeAddress: 'Jakarta',
    storePhone: '021-12345678', defaultTaxRate: '11', taxType: 'inclusive',
    currency: 'IDR', timezone: 'Asia/Jakarta', autoGenerateOrderNumber: true,
  });
  console.log('✓ tenant_settings');

  // 7. User-outlet assignments
  console.log('Seeding user_outlets...');
  const userOutletVals: { id: string; userId: string; outletId: string }[] = [];
  for (const uid of userIds) {
    const uIdx = userIds.indexOf(uid);
    const u = userData[uIdx];
    if (u.role === 'owner' || u.role === 'admin') {
      for (const oid of outletIds) {
        userOutletVals.push({ id: crypto.randomUUID(), userId: uid, outletId: oid });
      }
    } else {
      const oid = pick(outletIds);
      userOutletVals.push({ id: crypto.randomUUID(), userId: uid, outletId: oid });
    }
  }
  for (let i = 0; i < userOutletVals.length; i += BATCH) {
    await db.insert(userOutlets).values(userOutletVals.slice(i, i + BATCH));
  }
  console.log(`✓ ${userOutletVals.length} user_outlets`);

  // 8. Outlet settings
  console.log('Seeding outlet_settings...');
  const outletSettingsVals = outletIds.map((oid, i) => ({
    id: crypto.randomUUID(), outletId: oid,
    storeNameOverride: outletData[i].name,
  }));
  await db.insert(outletSettings).values(outletSettingsVals);
  console.log(`✓ ${outletSettingsVals.length} outlet_settings`);

  // 9. Add-ons
  console.log('Seeding add_ons...');
  const addOnIds = addOnNames.map(() => crypto.randomUUID());
  await db.insert(addOns).values(addOnNames.map(([name, price], i) => ({
    id: addOnIds[i], name: name as string,
    price: String((price as number) * 1000), isActive: true,
  })));
  console.log(`✓ ${addOnIds.length} add_ons`);

  // 10. Product-AddOn links
  console.log('Seeding product_add_ons...');
  const paVals: { id: string; productId: string; addOnId: string }[] = [];
  for (let i = 0; i < prodIds.length; i++) {
    const count = randomInt(0, 3);
    for (let j = 0; j < count; j++) {
      const aId = pick(addOnIds);
      if (paVals.some(v => v.productId === prodIds[i] && v.addOnId === aId)) continue;
      paVals.push({ id: crypto.randomUUID(), productId: prodIds[i], addOnId: aId });
    }
  }
  for (let i = 0; i < paVals.length; i += BATCH) {
    await db.insert(productAddOns).values(paVals.slice(i, i + BATCH));
  }
  console.log(`✓ ${paVals.length} product_add_ons`);

  // 11. Outlet-AddOn links
  console.log('Seeding outlet_add_ons...');
  const oaVals: { id: string; outletId: string; addOnId: string; price: string | null; isAvailable: boolean }[] = [];
  for (const oid of outletIds) {
    const selected = pickN(addOnIds, randomInt(5, 15));
    for (const aId of selected) {
      oaVals.push({
        id: crypto.randomUUID(), outletId: oid, addOnId: aId,
        price: Math.random() > 0.5 ? null : String(randomInt(1, 5) * 1000),
        isAvailable: true,
      });
    }
  }
  for (let i = 0; i < oaVals.length; i += BATCH) {
    await db.insert(outletAddOns).values(oaVals.slice(i, i + BATCH));
  }
  console.log(`✓ ${oaVals.length} outlet_add_ons`);

  // 12. Outlet products + stock movements
  console.log('Seeding outlet_products & stock_movements...');
  let opCount = 0;
  const smVals: any[] = [];
  for (const oid of outletIds) {
    const opBatch = prodIds.map((pid) => ({
      id: crypto.randomUUID(), outletId: oid, productId: pid,
      stock: randomInt(10, 100), isAvailable: true,
    }));
    for (let i = 0; i < opBatch.length; i += BATCH) {
      await db.insert(outletProducts).values(opBatch.slice(i, i + BATCH));
    }
    opCount += opBatch.length;
    // stock movements
    for (const op of opBatch) {
      smVals.push({
        id: crypto.randomUUID(), outletId: oid, productId: op.productId,
        type: 'initial' as const, quantityChange: op.stock, stockAfter: op.stock,
        note: 'Initial stock from seeding',
      });
    }
  }
  for (let i = 0; i < smVals.length; i += BATCH) {
    await db.insert(stockMovements).values(smVals.slice(i, i + BATCH));
  }
  console.log(`✓ ${opCount} outlet_products, ${smVals.length} stock_movements`);

  // 13. Modifier groups
  console.log('Seeding modifier_groups...');
  const mgIds: string[] = [];
  const mgProdIdx: number[] = []; // which product each group belongs to
  // assign groups to first 20 products (or less if fewer groups)
  for (let i = 0; i < modGroupData.length; i++) {
    mgIds.push(crypto.randomUUID());
    mgProdIdx.push(i % prodIds.length);
  }
  await db.insert(mg).values(modGroupData.map((g, i) => ({
    id: mgIds[i], productId: prodIds[mgProdIdx[i]],
    name: g.name, selectionType: g.sel,
    minSelect: g.min, maxSelect: g.max, isRequired: g.req,
  })));
  console.log(`✓ ${mgIds.length} modifier_groups`);

  // 14. Modifiers
  console.log('Seeding modifiers...');
  const modIds: string[] = [];
  const modGroupIdx: number[] = []; // which group each modifier belongs to
  for (let i = 0; i < modItemData.length; i++) {
    modIds.push(crypto.randomUUID());
    modGroupIdx.push(modItemData[i].g);
  }
  for (let i = 0; i < modItemData.length; i += BATCH) {
    const batch = modItemData.slice(i, i + BATCH);
    await db.insert(mods).values(batch.map((m, j) => ({
      id: modIds[i + j], groupId: mgIds[m.g],
      name: m.name, priceAdjustment: String(m.price * 1000), isActive: true,
    })));
  }
  console.log(`✓ ${modIds.length} modifiers`);

  // 15. Outlet modifiers
  console.log('Seeding outlet_modifiers...');
  const omVals: { id: string; outletId: string; modifierId: string; isAvailable: boolean }[] = [];
  for (const oid of outletIds) {
    for (const mid of modIds) {
      if (Math.random() > 0.6) continue; // 40% chance available
      omVals.push({ id: crypto.randomUUID(), outletId: oid, modifierId: mid, isAvailable: true });
    }
  }
  for (let i = 0; i < omVals.length; i += BATCH) {
    await db.insert(outletModifiers).values(omVals.slice(i, i + BATCH));
  }
  console.log(`✓ ${omVals.length} outlet_modifiers`);

  // 16. Floor plans
  console.log('Seeding floor_plans...');
  const fpIds = floorData.map(() => crypto.randomUUID());
  await db.insert(floorPlans).values(floorData.map((f, i) => ({
    id: fpIds[i], outletId: outletIds[f.outletIdx],
    name: f.name, width: f.w, height: f.h, isActive: true,
  })));
  console.log(`✓ ${fpIds.length} floor_plans`);

  // 17. Tables
  console.log('Seeding tables...');
  for (const t of tableDefs) {
    await client.query(
      `INSERT INTO "tables" (id, floor_plan_id, number, capacity, shape, pos_x, pos_y, status, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [crypto.randomUUID(), fpIds[t.fi], String(t.num), t.cap,
       t.cap >= 6 ? 'rectangle' : 'circle', randomInt(20, 500), randomInt(20, 500), 'Empty', true]
    );
  }
  console.log(`✓ ${tableDefs.length} tables`);

  // 18. Customers
  console.log('Seeding customers...');
  const custIds: string[] = [];
  const custNames: string[] = [];
  const custPhones: string[] = [];
  for (let i = 0; i < 200; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[i % lastNames.length];
    custIds.push(crypto.randomUUID());
    custNames.push(`${fn} ${ln}`);
    custPhones.push(`0812${pad(i, 8)}`);
  }
  for (let i = 0; i < custIds.length; i += BATCH) {
    const batch = custIds.slice(i, i + BATCH);
    await db.insert(customers).values(batch.map((id, j) => ({
      id,
      name: custNames[i + j],
      phone: custPhones[i + j],
      email: Math.random() > 0.5
        ? `${firstNames[(i + j) % firstNames.length].toLowerCase()}.${lastNames[(i + j) % lastNames.length].toLowerCase()}${i + j}@email.com`
        : null,
    })));
  }
  console.log(`✓ ${custIds.length} customers`);

  // 19. Cashier sessions
  console.log('Seeding cashier_sessions...');
  const sessIds: string[] = [];
  const sessData: {
    id: string; outletId: string; cashierId: string; cashierName: string;
    status: string; openedAt: Date; closedAt: Date | null;
    startingCash: string; endingCash: string | null;
    expectedCash: string | null; cashDifference: string | null;
  }[] = [];

  const cashierUserIds = userData.map((u, i) => u.role === 'cashier' ? userIds[i] : '').filter(Boolean);
  const nonCashierUserIds = userData.map((u, i) => u.role !== 'cashier' ? userIds[i] : '').filter(Boolean);
  const usedPairs = new Set<string>();

  for (let i = 0; i < 50; i++) {
    let oid: string, uid: string, uName: string;
    if (i < 20) {
      do {
        oid = pick(outletIds);
        uid = pick(cashierUserIds);
      } while (usedPairs.has(`${oid}:${uid}`));
      usedPairs.add(`${oid}:${uid}`);
      const ui = userIds.indexOf(uid);
      uName = userData[ui].name;
    } else {
      oid = outletIds[i % outletIds.length];
      const ui = i % userIds.length;
      uid = userIds[ui];
      uName = userData[ui].name;
    }
    const id = crypto.randomUUID();
    sessIds.push(id);
    const daysAgo = randomInt(0, 29);
    const hrs = randomInt(7, 20);
    const openedAt = new Date();
    openedAt.setDate(openedAt.getDate() - daysAgo);
    openedAt.setHours(hrs, randomInt(0, 59), 0, 0);
    const isOpen = i < 20;
    const startCash = String(randomInt(200, 1000) * 1000);
    let closedAt: Date | null = null;
    let endCash: string | null = null;
    let expCash: string | null = null;
    let diff: string | null = null;
    if (!isOpen) {
      closedAt = new Date(openedAt);
      closedAt.setHours(closedAt.getHours() + randomInt(6, 12));
      endCash = String(randomInt(500, 3000) * 1000);
      expCash = endCash;
      diff = '0';
    }
    sessData.push({
      id, outletId: oid, cashierId: uid,
      cashierName: uName, status: isOpen ? 'OPEN' : 'CLOSED',
      openedAt, closedAt, startingCash: startCash,
      endingCash: endCash, expectedCash: expCash, cashDifference: diff,
    });
  }
  for (let i = 0; i < sessData.length; i += BATCH) {
    await db.insert(cashierSessions).values(sessData.slice(i, i + BATCH));
  }
  console.log(`✓ ${sessIds.length} cashier_sessions`);

  // 20. Orders + 21. Order items
  console.log('Seeding orders & order_items...');
  const orderIds: string[] = [];
  const orderData: any[] = [];
  const oiData: any[] = [];
  let orderNumCounters: Record<string, number> = {};

  // distribute orders across sessions to get ~1000 order_items
  const activeSessions = sessData.filter(s => true);
  const targetOi = 1000;
  let remainingOi = targetOi;

  for (let si = 0; si < activeSessions.length && remainingOi > 0; si++) {
    const session = activeSessions[si];
    const sessionsLeft = activeSessions.length - si;
    const itemsForThisSession = Math.max(1, Math.floor(remainingOi / sessionsLeft) + randomInt(-1, 2));
    let itemsCreated = 0;

    while (itemsCreated < itemsForThisSession && remainingOi > 0) {
      const oid = crypto.randomUUID();
      orderIds.push(oid);
      const itemCount = Math.min(randomInt(1, 6), remainingOi);
      const items: { pId: string; pName: string; qty: number; price: string }[] = [];
      let sub = 0;
      for (let k = 0; k < itemCount; k++) {
        const pIdx = randomInt(0, prodIds.length - 1);
        const price = prodData[pIdx].sell * 1000;
        const qty = randomInt(1, 3);
        items.push({
          pId: prodIds[pIdx], pName: prodData[pIdx].name,
          qty, price: String(price),
        });
        sub += price * qty;
      }
      // outlet code
      const outletIdx = outletIds.indexOf(session.outletId as (typeof outletIds)[number]);
      const code = outletData[outletIdx]?.code ?? 'OUT';
      const dateStr = seqResetBase(session.openedAt);
      const key = `${code}-${dateStr}`;
      orderNumCounters[key] = (orderNumCounters[key] ?? 0) + 1;
      const seq = orderNumCounters[key];
      const total = sub;
      const paid = total + randomInt(0, 5000);
      const orderTs = new Date(session.openedAt.getTime() + randomInt(0, 3600000) * (itemsCreated + 1));
      orderData.push({
        id: oid,
        idempotencyKey: crypto.randomUUID(),
        outletId: session.outletId,
        sessionId: session.id,
        subtotal: String(sub),
        taxAmount: '0',
        discountAmount: '0',
        totalAmount: String(total),
        paymentMethod: pick(['cash', 'qris', 'debit_card', 'cash', 'cash']),
        amountPaid: String(paid),
        changeAmount: String(paid - total),
        cashierId: session.cashierId,
        cashierName: session.cashierName,
        orderNumber: `${code}-${dateStr}-${pad(seq, 3)}`,
        status: 'completed',
        memberId: null,
        createdAt: orderTs,
      });
      for (const item of items) {
        oiData.push({
          id: crypto.randomUUID(),
          orderId: oid,
          productId: item.pId,
          productName: item.pName,
          quantity: item.qty,
          price: item.price,
          subtotal: String(Number(item.price) * item.qty),
          notes: Math.random() > 0.8 ? 'Extra note for testing' : null,
        });
        remainingOi--;
      }
      itemsCreated += itemCount;
    }
  }
  // Insert orders
  for (let i = 0; i < orderData.length; i += BATCH) {
    await db.insert(orders).values(orderData.slice(i, i + BATCH));
  }
  // Insert order items
  for (let i = 0; i < oiData.length; i += BATCH) {
    await db.insert(orderItems).values(oiData.slice(i, i + BATCH));
  }
  console.log(`✓ ${orderData.length} orders, ${oiData.length} order_items`);

  // 22. Refresh tokens
  console.log('Seeding refresh_tokens...');
  for (const uid of userIds) {
    await db.insert(refreshTokens).values({
      id: crypto.randomUUID(), userId: uid,
      tokenHash: crypto.randomUUID(), expiresAt: new Date(Date.now() + 30 * 86400000),
    });
  }
  console.log(`✓ ${userIds.length} refresh_tokens`);

  // ── SUMMARY ──
  console.log('\n✅ Seed completed!');
  console.log(`  • ${userIds.length} users`);
  console.log(`  • ${catIds.length} categories`);
  console.log(`  • ${prodIds.length} products`);
  console.log(`  • ${outletIds.length} outlets`);
  console.log(`  • ${addOnIds.length} add_ons`);
  console.log(`  • ${opCount} outlet_products`);
  console.log(`  • ${smVals.length} stock_movements`);
  console.log(`  • ${mgIds.length} modifier_groups`);
  console.log(`  • ${modIds.length} modifiers`);
  console.log(`  • ${fpIds.length} floor_plans`);
  console.log(`  • ${tableDefs.length} tables`);
  console.log(`  • ${custIds.length} customers`);
  console.log(`  • ${sessIds.length} cashier_sessions`);
  console.log(`  • ${orderData.length} orders`);
  console.log(`  • ${oiData.length} order_items`);

  await client.end();
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
