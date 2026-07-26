import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { categories, products, outletProducts as outletProductsTable, outlets, stockMovements } from '../db/tenant_schema';
import { sql, eq } from 'drizzle-orm';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const TENANT_SCHEMA = 'tenant_1784154091490_axlo18';

const categoryData = [
  { name: 'Makanan Pembuka', description: 'Aneka hidangan pembuka ringan' },
  { name: 'Makanan Utama', description: 'Hidangan utama spesial' },
  { name: 'Nasi', description: 'Aneka olahan nasi' },
  { name: 'Mie & Pasta', description: 'Mie dan pasta berbagai olahan' },
  { name: 'Ayam', description: 'Olahan ayam goreng, bakar, geprek' },
  { name: 'Ikan', description: 'Olahan ikan air tawar & laut' },
  { name: 'Seafood', description: 'Udang, cumi, kepiting & kerang' },
  { name: 'Daging Sapi', description: 'Olahan daging sapi pilihan' },
  { name: 'Sayuran', description: 'Sayuran segar diolah sehat' },
  { name: 'Sup', description: 'Sup dan soto hangat' },
  { name: 'Sate', description: 'Aneka sate tusuk' },
  { name: 'Bakar & Panggang', description: 'Hidangan bakar dan panggang' },
  { name: 'Cemilan', description: 'Cemilan ringan teman santai' },
  { name: 'Gorengan', description: 'Aneka gorengan tradisional' },
  { name: 'Roti & Bakery', description: 'Roti dan kue panggang' },
  { name: 'Dessert', description: 'Pencuci mulut manis' },
  { name: 'Minuman Panas', description: 'Minuman hangat menenangkan' },
  { name: 'Kopi', description: 'Kopi spesial dari berbagai variasi' },
  { name: 'Minuman Dingin', description: 'Minuman segar dingin' },
  { name: 'Jus & Smoothie', description: 'Jus buah dan smoothie sehat' },
];

type ProductSeed = {
  name: string;
  costPrice: number;
  sellPrice: number;
  categoryIdx: number;
};

const productData: ProductSeed[] = [
  // Makanan Pembuka (idx 0)
  { name: 'Lumpia Semarang', costPrice: 12000, sellPrice: 18000, categoryIdx: 0 },
  { name: 'Spring Roll Udang', costPrice: 10000, sellPrice: 15000, categoryIdx: 0 },
  { name: 'Siomay Bandung', costPrice: 8000, sellPrice: 12000, categoryIdx: 0 },
  { name: 'Batagor', costPrice: 10000, sellPrice: 15000, categoryIdx: 0 },
  { name: 'Cireng Isi Ayam', costPrice: 8000, sellPrice: 12000, categoryIdx: 0 },
  { name: 'Pastel Tutup', costPrice: 15000, sellPrice: 25000, categoryIdx: 0 },
  { name: 'Risol Mayo', costPrice: 7000, sellPrice: 10000, categoryIdx: 0 },
  { name: 'Kroket Kentang', costPrice: 7000, sellPrice: 10000, categoryIdx: 0 },
  { name: 'Pangsit Goreng', costPrice: 8000, sellPrice: 12000, categoryIdx: 0 },
  { name: 'Tahu Isi Pedas', costPrice: 6000, sellPrice: 10000, categoryIdx: 0 },

  // Makanan Utama (idx 1)
  { name: 'Nasi Goreng Spesial', costPrice: 20000, sellPrice: 35000, categoryIdx: 1 },
  { name: 'Nasi Goreng Seafood', costPrice: 25000, sellPrice: 40000, categoryIdx: 1 },
  { name: 'Nasi Goreng Kampung', costPrice: 15000, sellPrice: 28000, categoryIdx: 1 },
  { name: 'Nasi Goreng Merah', costPrice: 18000, sellPrice: 30000, categoryIdx: 1 },
  { name: 'Nasi Goreng Hitam', costPrice: 20000, sellPrice: 32000, categoryIdx: 1 },
  { name: 'Nasi Kuning Komplit', costPrice: 25000, sellPrice: 40000, categoryIdx: 1 },
  { name: 'Nasi Uduk Komplit', costPrice: 22000, sellPrice: 38000, categoryIdx: 1 },
  { name: 'Nasi Liwet Komplit', costPrice: 25000, sellPrice: 42000, categoryIdx: 1 },
  { name: 'Nasi Bakar Ayam', costPrice: 20000, sellPrice: 35000, categoryIdx: 1 },
  { name: 'Nasi Tutug Oncom', costPrice: 18000, sellPrice: 30000, categoryIdx: 1 },

  // Nasi (idx 2)
  { name: 'Nasi Putih', costPrice: 3000, sellPrice: 5000, categoryIdx: 2 },
  { name: 'Nasi Merah', costPrice: 4000, sellPrice: 7000, categoryIdx: 2 },
  { name: 'Nasi Gurih', costPrice: 5000, sellPrice: 8000, categoryIdx: 2 },
  { name: 'Nasi Liwet Solo', costPrice: 20000, sellPrice: 35000, categoryIdx: 2 },
  { name: 'Nasi Megono', costPrice: 15000, sellPrice: 25000, categoryIdx: 2 },
  { name: 'Nasi Jamblang', costPrice: 18000, sellPrice: 30000, categoryIdx: 2 },
  { name: 'Nasi Pecel', costPrice: 12000, sellPrice: 20000, categoryIdx: 2 },
  { name: 'Nasi Rames', costPrice: 15000, sellPrice: 25000, categoryIdx: 2 },
  { name: 'Nasi Campur Bali', costPrice: 22000, sellPrice: 38000, categoryIdx: 2 },
  { name: 'Nasi Tumpeng Mini', costPrice: 30000, sellPrice: 50000, categoryIdx: 2 },

  // Mie & Pasta (idx 3)
  { name: 'Mie Ayam Original', costPrice: 12000, sellPrice: 20000, categoryIdx: 3 },
  { name: 'Mie Ayam Bakso', costPrice: 15000, sellPrice: 25000, categoryIdx: 3 },
  { name: 'Mie Ayam Ceker', costPrice: 15000, sellPrice: 25000, categoryIdx: 3 },
  { name: 'Mie Ayam Komplit', costPrice: 18000, sellPrice: 30000, categoryIdx: 3 },
  { name: 'Mie Goreng Jawa', costPrice: 12000, sellPrice: 20000, categoryIdx: 3 },
  { name: 'Mie Godog Jawa', costPrice: 12000, sellPrice: 20000, categoryIdx: 3 },
  { name: 'Mie Rebus Biasa', costPrice: 12000, sellPrice: 20000, categoryIdx: 3 },
  { name: 'Mie Kocok Bandung', costPrice: 18000, sellPrice: 30000, categoryIdx: 3 },
  { name: 'Mie Aceh Goreng', costPrice: 20000, sellPrice: 35000, categoryIdx: 3 },
  { name: 'Spaghetti Bolognese', costPrice: 25000, sellPrice: 42000, categoryIdx: 3 },

  // Ayam (idx 4)
  { name: 'Ayam Goreng Biasa', costPrice: 15000, sellPrice: 25000, categoryIdx: 4 },
  { name: 'Ayam Goreng Kremes', costPrice: 18000, sellPrice: 28000, categoryIdx: 4 },
  { name: 'Ayam Bakar Taliwang', costPrice: 18000, sellPrice: 30000, categoryIdx: 4 },
  { name: 'Ayam Bakar Madu', costPrice: 20000, sellPrice: 32000, categoryIdx: 4 },
  { name: 'Ayam Panggang', costPrice: 20000, sellPrice: 35000, categoryIdx: 4 },
  { name: 'Ayam Geprek Original', costPrice: 15000, sellPrice: 25000, categoryIdx: 4 },
  { name: 'Ayam Penyet', costPrice: 15000, sellPrice: 25000, categoryIdx: 4 },
  { name: 'Ayam Pop', costPrice: 18000, sellPrice: 28000, categoryIdx: 4 },
  { name: 'Ayam Rica-Rica', costPrice: 20000, sellPrice: 35000, categoryIdx: 4 },
  { name: 'Ayam Woku', costPrice: 22000, sellPrice: 35000, categoryIdx: 4 },

  // Ikan (idx 5)
  { name: 'Ikan Bakar Tepi', costPrice: 25000, sellPrice: 40000, categoryIdx: 5 },
  { name: 'Ikan Goreng Tepi', costPrice: 20000, sellPrice: 35000, categoryIdx: 5 },
  { name: 'Ikan Nila Bakar', costPrice: 22000, sellPrice: 38000, categoryIdx: 5 },
  { name: 'Gurame Goreng', costPrice: 30000, sellPrice: 50000, categoryIdx: 5 },
  { name: 'Gurame Bakar', costPrice: 35000, sellPrice: 55000, categoryIdx: 5 },
  { name: 'Lele Goreng', costPrice: 12000, sellPrice: 20000, categoryIdx: 5 },
  { name: 'Lele Bakar', costPrice: 15000, sellPrice: 22000, categoryIdx: 5 },
  { name: 'Patin Bakar', costPrice: 25000, sellPrice: 42000, categoryIdx: 5 },
  { name: 'Kakap Bakar', costPrice: 35000, sellPrice: 55000, categoryIdx: 5 },
  { name: 'Pepes Ikan', costPrice: 18000, sellPrice: 30000, categoryIdx: 5 },

  // Seafood (idx 6)
  { name: 'Udang Goreng Tepung', costPrice: 25000, sellPrice: 40000, categoryIdx: 6 },
  { name: 'Udang Bakar Madu', costPrice: 30000, sellPrice: 50000, categoryIdx: 6 },
  { name: 'Cumi Goreng Tepung', costPrice: 22000, sellPrice: 38000, categoryIdx: 6 },
  { name: 'Cumi Bakar Isi', costPrice: 28000, sellPrice: 45000, categoryIdx: 6 },
  { name: 'Cumi Rica-Rica', costPrice: 25000, sellPrice: 42000, categoryIdx: 6 },
  { name: 'Kepiting Saus Padang', costPrice: 50000, sellPrice: 85000, categoryIdx: 6 },
  { name: 'Kerang Dara Rebus', costPrice: 20000, sellPrice: 35000, categoryIdx: 6 },
  { name: 'Kerang Hijau Saus Tiram', costPrice: 22000, sellPrice: 38000, categoryIdx: 6 },
  { name: 'Lobster Asam Manis', costPrice: 60000, sellPrice: 100000, categoryIdx: 6 },
  { name: 'Fish and Chips', costPrice: 20000, sellPrice: 35000, categoryIdx: 6 },

  // Daging Sapi (idx 7)
  { name: 'Rendang Sapi', costPrice: 30000, sellPrice: 50000, categoryIdx: 7 },
  { name: 'Sapi Lada Hitam', costPrice: 28000, sellPrice: 45000, categoryIdx: 7 },
  { name: 'Sapi Teriyaki', costPrice: 25000, sellPrice: 42000, categoryIdx: 7 },
  { name: 'Steak Sapi', costPrice: 45000, sellPrice: 75000, categoryIdx: 7 },
  { name: 'Rawon', costPrice: 20000, sellPrice: 35000, categoryIdx: 7 },
  { name: 'Tongseng Sapi', costPrice: 22000, sellPrice: 38000, categoryIdx: 7 },
  { name: 'Sop Buntut', costPrice: 30000, sellPrice: 50000, categoryIdx: 7 },
  { name: 'Semur Sapi', costPrice: 22000, sellPrice: 38000, categoryIdx: 7 },
  { name: 'Dendeng Balado', costPrice: 25000, sellPrice: 42000, categoryIdx: 7 },
  { name: 'Sapi Cabe Ijo', costPrice: 25000, sellPrice: 40000, categoryIdx: 7 },

  // Sayuran (idx 8)
  { name: 'Capcay Kuah', costPrice: 15000, sellPrice: 25000, categoryIdx: 8 },
  { name: 'Capcay Seafood', costPrice: 22000, sellPrice: 35000, categoryIdx: 8 },
  { name: 'Kangkung Belacan', costPrice: 12000, sellPrice: 20000, categoryIdx: 8 },
  { name: 'Kangkung Cah Bawang', costPrice: 10000, sellPrice: 18000, categoryIdx: 8 },
  { name: 'Sayur Asem', costPrice: 10000, sellPrice: 15000, categoryIdx: 8 },
  { name: 'Sayur Lodeh', costPrice: 10000, sellPrice: 15000, categoryIdx: 8 },
  { name: 'Tumis Buncis', costPrice: 12000, sellPrice: 20000, categoryIdx: 8 },
  { name: 'Tumis Kacang Panjang', costPrice: 10000, sellPrice: 18000, categoryIdx: 8 },
  { name: 'Cah Brokoli', costPrice: 15000, sellPrice: 25000, categoryIdx: 8 },
  { name: 'Pecel Sayur', costPrice: 10000, sellPrice: 18000, categoryIdx: 8 },

  // Sup (idx 9)
  { name: 'Sop Ayam', costPrice: 12000, sellPrice: 20000, categoryIdx: 9 },
  { name: 'Sop Iga Sapi', costPrice: 25000, sellPrice: 42000, categoryIdx: 9 },
  { name: 'Sop Sayuran', costPrice: 10000, sellPrice: 18000, categoryIdx: 9 },
  { name: 'Sop Kambing', costPrice: 25000, sellPrice: 42000, categoryIdx: 9 },
  { name: 'Sop Buntut', costPrice: 30000, sellPrice: 50000, categoryIdx: 9 },
  { name: 'Soto Ayam', costPrice: 12000, sellPrice: 20000, categoryIdx: 9 },
  { name: 'Soto Betawi', costPrice: 18000, sellPrice: 30000, categoryIdx: 9 },
  { name: 'Soto Mie Bogor', costPrice: 15000, sellPrice: 25000, categoryIdx: 9 },
  { name: 'Bakso Sapi', costPrice: 12000, sellPrice: 20000, categoryIdx: 9 },
  { name: 'Bakso Urat', costPrice: 15000, sellPrice: 25000, categoryIdx: 9 },

  // Sate (idx 10)
  { name: 'Sate Ayam', costPrice: 18000, sellPrice: 30000, categoryIdx: 10 },
  { name: 'Sate Kambing', costPrice: 25000, sellPrice: 42000, categoryIdx: 10 },
  { name: 'Sate Sapi', costPrice: 25000, sellPrice: 40000, categoryIdx: 10 },
  { name: 'Sate Lilit Bali', costPrice: 22000, sellPrice: 35000, categoryIdx: 10 },
  { name: 'Sate Padang', costPrice: 20000, sellPrice: 35000, categoryIdx: 10 },
  { name: 'Sate Balibul', costPrice: 18000, sellPrice: 30000, categoryIdx: 10 },
  { name: 'Sate Usus', costPrice: 10000, sellPrice: 18000, categoryIdx: 10 },
  { name: 'Sate Telur Puyuh', costPrice: 12000, sellPrice: 20000, categoryIdx: 10 },
  { name: 'Sate Kulit Ayam', costPrice: 10000, sellPrice: 18000, categoryIdx: 10 },
  { name: 'Sate Languan', costPrice: 15000, sellPrice: 25000, categoryIdx: 10 },

  // Bakar & Panggang (idx 11)
  { name: 'Ayam Bakar Taliwang', costPrice: 22000, sellPrice: 38000, categoryIdx: 11 },
  { name: 'Ayam Bakar Padang', costPrice: 20000, sellPrice: 35000, categoryIdx: 11 },
  { name: 'Iga Bakar Madu', costPrice: 35000, sellPrice: 55000, categoryIdx: 11 },
  { name: 'Gurame Bakar Pesmol', costPrice: 30000, sellPrice: 50000, categoryIdx: 11 },
  { name: 'Udang Bakar Madu', costPrice: 28000, sellPrice: 45000, categoryIdx: 11 },
  { name: 'Cumi Bakar Isi Tahu', costPrice: 25000, sellPrice: 42000, categoryIdx: 11 },
  { name: 'Sate Pusut', costPrice: 18000, sellPrice: 30000, categoryIdx: 11 },
  { name: 'Pisang Bakar Keju', costPrice: 10000, sellPrice: 18000, categoryIdx: 11 },
  { name: 'Jagung Bakar Mentega', costPrice: 8000, sellPrice: 15000, categoryIdx: 11 },
  { name: 'Roti Bakar Coklat Keju', costPrice: 8000, sellPrice: 15000, categoryIdx: 11 },

  // Cemilan (idx 12)
  { name: 'Keripik Singkong Balado', costPrice: 8000, sellPrice: 12000, categoryIdx: 12 },
  { name: 'Keripik Pisang Manis', costPrice: 8000, sellPrice: 12000, categoryIdx: 12 },
  { name: 'Makaroni Keju Panggang', costPrice: 10000, sellPrice: 15000, categoryIdx: 12 },
  { name: 'Kentang Goreng Keju', costPrice: 10000, sellPrice: 18000, categoryIdx: 12 },
  { name: 'Onion Ring', costPrice: 10000, sellPrice: 18000, categoryIdx: 12 },
  { name: 'Telur Gulung', costPrice: 5000, sellPrice: 10000, categoryIdx: 12 },
  { name: 'Sosis Goreng', costPrice: 7000, sellPrice: 12000, categoryIdx: 12 },
  { name: 'Nugget Ayam', costPrice: 10000, sellPrice: 18000, categoryIdx: 12 },
  { name: 'Takoyaki', costPrice: 12000, sellPrice: 20000, categoryIdx: 12 },
  { name: 'Okonomiyaki', costPrice: 15000, sellPrice: 25000, categoryIdx: 12 },

  // Gorengan (idx 13)
  { name: 'Tahu Goreng', costPrice: 5000, sellPrice: 8000, categoryIdx: 13 },
  { name: 'Tempe Goreng', costPrice: 4000, sellPrice: 7000, categoryIdx: 13 },
  { name: 'Pisang Goreng', costPrice: 6000, sellPrice: 10000, categoryIdx: 13 },
  { name: 'Singkong Goreng', costPrice: 6000, sellPrice: 10000, categoryIdx: 13 },
  { name: 'Bakwan Sayur', costPrice: 5000, sellPrice: 8000, categoryIdx: 13 },
  { name: 'Combro', costPrice: 5000, sellPrice: 8000, categoryIdx: 13 },
  { name: 'Misro', costPrice: 5000, sellPrice: 8000, categoryIdx: 13 },
  { name: 'Tahu Sumedang', costPrice: 7000, sellPrice: 12000, categoryIdx: 13 },
  { name: 'Cireng Crispy', costPrice: 7000, sellPrice: 12000, categoryIdx: 13 },
  { name: 'Molen Pisang', costPrice: 6000, sellPrice: 10000, categoryIdx: 13 },

  // Roti & Bakery (idx 14)
  { name: 'Roti Bakar Coklat', costPrice: 10000, sellPrice: 18000, categoryIdx: 14 },
  { name: 'Roti Bakar Keju', costPrice: 10000, sellPrice: 18000, categoryIdx: 14 },
  { name: 'Roti Bakar Pisang Keju', costPrice: 12000, sellPrice: 20000, categoryIdx: 14 },
  { name: 'Sandwich Ayam Mayo', costPrice: 15000, sellPrice: 25000, categoryIdx: 14 },
  { name: 'Sandwich Tuna', costPrice: 15000, sellPrice: 25000, categoryIdx: 14 },
  { name: 'Croissant Coklat', costPrice: 12000, sellPrice: 20000, categoryIdx: 14 },
  { name: 'Donat Glazed', costPrice: 8000, sellPrice: 12000, categoryIdx: 14 },
  { name: 'Bolu Panggang', costPrice: 15000, sellPrice: 25000, categoryIdx: 14 },
  { name: 'Muffin Blueberry', costPrice: 10000, sellPrice: 15000, categoryIdx: 14 },
  { name: 'Pancake Maple', costPrice: 15000, sellPrice: 25000, categoryIdx: 14 },

  // Dessert (idx 15)
  { name: 'Es Krim Vanilla', costPrice: 8000, sellPrice: 15000, categoryIdx: 15 },
  { name: 'Es Krim Coklat', costPrice: 8000, sellPrice: 15000, categoryIdx: 15 },
  { name: 'Es Krim Stroberi', costPrice: 8000, sellPrice: 15000, categoryIdx: 15 },
  { name: 'Pudding Coklat Vla', costPrice: 10000, sellPrice: 18000, categoryIdx: 15 },
  { name: 'Pudding Buah Segar', costPrice: 12000, sellPrice: 20000, categoryIdx: 15 },
  { name: 'Pudding Karamel', costPrice: 10000, sellPrice: 18000, categoryIdx: 15 },
  { name: 'Klepon', costPrice: 8000, sellPrice: 12000, categoryIdx: 15 },
  { name: 'Getuk Lindri', costPrice: 8000, sellPrice: 12000, categoryIdx: 15 },
  { name: 'Kolak Pisang', costPrice: 10000, sellPrice: 15000, categoryIdx: 15 },
  { name: 'Bubur Sumsum', costPrice: 10000, sellPrice: 15000, categoryIdx: 15 },

  // Minuman Panas (idx 16)
  { name: 'Teh Tawar Hangat', costPrice: 3000, sellPrice: 5000, categoryIdx: 16 },
  { name: 'Teh Manis Hangat', costPrice: 4000, sellPrice: 7000, categoryIdx: 16 },
  { name: 'Teh Jahe Hangat', costPrice: 6000, sellPrice: 10000, categoryIdx: 16 },
  { name: 'Wedang Ronde', costPrice: 10000, sellPrice: 18000, categoryIdx: 16 },
  { name: 'Wedang Uwuh', costPrice: 12000, sellPrice: 20000, categoryIdx: 16 },
  { name: 'Bandrek', costPrice: 10000, sellPrice: 18000, categoryIdx: 16 },
  { name: 'Bajigur', costPrice: 10000, sellPrice: 18000, categoryIdx: 16 },
  { name: 'Susu Jahe Hangat', costPrice: 8000, sellPrice: 15000, categoryIdx: 16 },
  { name: 'Coklat Panas', costPrice: 12000, sellPrice: 20000, categoryIdx: 16 },
  { name: 'Lemon Tea Hangat', costPrice: 8000, sellPrice: 12000, categoryIdx: 16 },

  // Kopi (idx 17)
  { name: 'Kopi Hitam', costPrice: 5000, sellPrice: 10000, categoryIdx: 17 },
  { name: 'Kopi Susu', costPrice: 8000, sellPrice: 15000, categoryIdx: 17 },
  { name: 'Kopi Gula Aren', costPrice: 12000, sellPrice: 20000, categoryIdx: 17 },
  { name: 'Cappuccino', costPrice: 15000, sellPrice: 25000, categoryIdx: 17 },
  { name: 'Cafe Latte', costPrice: 18000, sellPrice: 28000, categoryIdx: 17 },
  { name: 'Mochaccino', costPrice: 20000, sellPrice: 32000, categoryIdx: 17 },
  { name: 'Espresso', costPrice: 8000, sellPrice: 15000, categoryIdx: 17 },
  { name: 'Americano', costPrice: 10000, sellPrice: 18000, categoryIdx: 17 },
  { name: 'Affogato', costPrice: 18000, sellPrice: 30000, categoryIdx: 17 },
  { name: 'Kopi Vietnam', costPrice: 15000, sellPrice: 25000, categoryIdx: 17 },

  // Minuman Dingin (idx 18)
  { name: 'Es Teh Manis', costPrice: 4000, sellPrice: 7000, categoryIdx: 18 },
  { name: 'Es Teh Tawar', costPrice: 3000, sellPrice: 5000, categoryIdx: 18 },
  { name: 'Es Jeruk', costPrice: 6000, sellPrice: 10000, categoryIdx: 18 },
  { name: 'Es Lemon Tea', costPrice: 8000, sellPrice: 12000, categoryIdx: 18 },
  { name: 'Es Susu Coklat', costPrice: 7000, sellPrice: 12000, categoryIdx: 18 },
  { name: 'Es Coklat Sorbet', costPrice: 15000, sellPrice: 25000, categoryIdx: 18 },
  { name: 'Es Campur', costPrice: 12000, sellPrice: 20000, categoryIdx: 18 },
  { name: 'Es Teler', costPrice: 15000, sellPrice: 25000, categoryIdx: 18 },
  { name: 'Es Kopyor', costPrice: 15000, sellPrice: 25000, categoryIdx: 18 },
  { name: 'Es Doger', costPrice: 12000, sellPrice: 20000, categoryIdx: 18 },

  // Jus & Smoothie (idx 19)
  { name: 'Jus Alpukat', costPrice: 12000, sellPrice: 20000, categoryIdx: 19 },
  { name: 'Jus Mangga', costPrice: 10000, sellPrice: 18000, categoryIdx: 19 },
  { name: 'Jus Jeruk Segar', costPrice: 10000, sellPrice: 18000, categoryIdx: 19 },
  { name: 'Jus Jambu Merah', costPrice: 10000, sellPrice: 18000, categoryIdx: 19 },
  { name: 'Jus Stroberi', costPrice: 12000, sellPrice: 20000, categoryIdx: 19 },
  { name: 'Jus Tomat', costPrice: 8000, sellPrice: 15000, categoryIdx: 19 },
  { name: 'Jus Wortel', costPrice: 8000, sellPrice: 15000, categoryIdx: 19 },
  { name: 'Smoothie Mangga', costPrice: 15000, sellPrice: 25000, categoryIdx: 19 },
  { name: 'Smoothie Alpukat', costPrice: 15000, sellPrice: 25000, categoryIdx: 19 },
  { name: 'Milkshake Coklat', costPrice: 18000, sellPrice: 28000, categoryIdx: 19 },
];

function getStock(index: number): number {
  if (index < 30) return 80 + (index * 7) % 70;
  if (index < 80) return 30 + (index * 13) % 50;
  if (index < 150) return 5 + (index * 3) % 25;
  if (index < 180) return 1 + (index * 5) % 4;
  return 0;
}

async function main() {
  console.log(`Connecting to database...`);
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const db = drizzle(client);

  console.log(`Setting search_path to "${TENANT_SCHEMA}"...`);
  await db.execute(sql`SET search_path TO ${sql.identifier(TENANT_SCHEMA)}`);

  // Check if data already exists
  const existingCats = await db.select({ count: sql<number>`COUNT(*)` }).from(categories);
  const catCount = Number(existingCats[0]?.count ?? 0);
  if (catCount > 0) {
    console.log(`Categories table already has ${catCount} rows. Skipping seed.`);
    console.log('Use --force to truncate and re-seed.');
    const args = process.argv.slice(2);
    if (!args.includes('--force')) {
      await client.end();
      return;
    }
    console.log('Force mode: truncating existing data...');
    await db.execute(sql`TRUNCATE TABLE categories CASCADE`);
  }

  const existingProds = await db.select({ count: sql<number>`COUNT(*)` }).from(products);
  const prodCount = Number(existingProds[0]?.count ?? 0);
  if (prodCount > 0) {
    const args = process.argv.slice(2);
    if (!args.includes('--force')) {
      console.log(`Products table already has ${prodCount} rows. Skipping seed.`);
      await client.end();
      return;
    }
    await db.execute(sql`TRUNCATE TABLE products CASCADE`);
  }

  // Seed categories
  console.log(`Seeding ${categoryData.length} categories...`);
  const catIds = categoryData.map(() => crypto.randomUUID());
  const catValues = categoryData.map((cat, i) => ({
    id: catIds[i],
    name: cat.name,
    description: cat.description,
  }));
  await db.insert(categories).values(catValues);
  console.log(`✓ ${catValues.length} categories inserted.`);

  // Seed products
  console.log(`Seeding ${productData.length} products...`);
  const BATCH_SIZE = 50;
  const productIds: string[] = [];
  for (let i = 0; i < productData.length; i += BATCH_SIZE) {
    const batch = productData.slice(i, i + BATCH_SIZE);
    const prodValues = batch.map((p, batchIdx) => {
      const globalIdx = i + batchIdx;
      const id = crypto.randomUUID();
      productIds.push(id);
      return {
        id,
        sku: `SKU-${String(globalIdx + 1).padStart(5, '0')}`,
        name: p.name,
        costPrice: p.costPrice.toString(),
        sellPrice: p.sellPrice.toString(),
        categoryId: catIds[p.categoryIdx],
        isGlobal: true,
        isActive: true,
        unit: 'pcs',
        type: 'STOCK' as const,
        taxType: 'none' as const,
      };
    });
    await db.insert(products).values(prodValues);
    console.log(`  ✓ ${i + batch.length}/${productData.length} products inserted.`);
  }

  // Seed outlet_products and stock_movements
  console.log(`\nSeeding outlet_products...`);
  const outletList = await db.select({ id: outlets.id, name: outlets.name }).from(outlets);
  if (outletList.length === 0) {
    console.log('  ⚠ No outlets found. Skipping outlet_products.');
  } else {
    for (const outlet of outletList) {
      const existingOp = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(outletProductsTable)
        .where(eq(outletProductsTable.outletId, outlet.id));
      if (Number(existingOp[0]?.count ?? 0) > 0 && !process.argv.slice(2).includes('--force')) {
        console.log(`  ⏭ Outlet "${outlet.name}" already has outlet_products. Skipping.`);
        continue;
      }

      const OUTLET_BATCH = 50;
      for (let i = 0; i < productIds.length; i += OUTLET_BATCH) {
        const batchIds = productIds.slice(i, i + OUTLET_BATCH);
        const opValues = batchIds.map((prodId, batchIdx) => {
          const globalIdx = i + batchIdx;
          const stock = getStock(globalIdx);
          return {
            id: crypto.randomUUID(),
            outletId: outlet.id,
            productId: prodId,
            stock,
            isAvailable: stock > 0,
          };
        });
        await db.insert(outletProductsTable).values(opValues);
        console.log(`  ✓ ${i + batchIds.length}/${productIds.length} outlet_products for "${outlet.name}"`);
      }

      // Also insert stock_movements (type='initial') for audit trail
      console.log(`  Seeding stock_movements for "${outlet.name}"...`);
      const smValues = productIds.map((prodId, idx) => {
        const stock = getStock(idx);
        return {
          id: crypto.randomUUID(),
          outletId: outlet.id,
          productId: prodId,
          type: 'initial' as const,
          quantityChange: stock,
          stockAfter: stock,
          note: 'Initial stock from seeding',
        };
      });
      const SM_BATCH = 100;
      for (let i = 0; i < smValues.length; i += SM_BATCH) {
        await db.insert(stockMovements).values(smValues.slice(i, i + SM_BATCH));
      }
      console.log(`  ✓ ${smValues.length} stock_movements for "${outlet.name}"`);
    }
  }

  console.log('\n✅ Seed completed successfully!');
  console.log(`  - ${categoryData.length} categories`);
  console.log(`  - ${productData.length} products (all is_global = true)`);
  const totalStock = productIds.reduce((sum, _, i) => sum + getStock(i), 0);
  console.log(`  - ${productData.length} outlet_products with ${totalStock} total stock across ${outletList.length} outlet(s)`);

  await client.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
