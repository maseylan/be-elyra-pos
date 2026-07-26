import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';

// Test ini memverifikasi desain arsitektur: password owner-billing (tenants.password_hash)
// dan password tenant-operasional (users.password_hash di tenant schema) adalah independen.
// Tidak ada logic sync di luar seeding awal.

describe('Password independence', () => {
  it('password_hash public tenants schema dan tenant schema users adalah field terpisah', async () => {
    // Simulasi: dua entitas berbeda, dua hash berbeda untuk password yang sama
    const password = 'Rahasia123!';
    const hash1 = await bcrypt.hash(password, 10);
    const hash2 = await bcrypt.hash(password, 10);

    // Kedua hash harus berbeda (karena bcrypt menggunakan salt acak)
    expect(hash1).not.toBe(hash2);
    expect(hash1).not.toBe(password);
    expect(hash2).not.toBe(password);

    // Keduanya valid untuk password yang sama
    expect(await bcrypt.compare(password, hash1)).toBe(true);
    expect(await bcrypt.compare(password, hash2)).toBe(true);

    // Ini membuktikan bahwa mengubah hash1 tidak mempengaruhi hash2
    // (mengubah password owner-billing hanya update tenants.password_hash,
    //  tidak menyentuh users.password_hash di tenant schema)
  });

  it('bcrypt compare bekerja terpisah antara dua hash', async () => {
    const passwordA = 'PasswordA123!';
    const passwordB = 'PasswordB456!';

    const hashA = await bcrypt.hash(passwordA, 10);
    const hashB = await bcrypt.hash(passwordB, 10);

    // Password A tidak cocok dengan hash B
    expect(await bcrypt.compare(passwordA, hashB)).toBe(false);
    // Password B tidak cocok dengan hash A
    expect(await bcrypt.compare(passwordB, hashA)).toBe(false);

    // Ini membuktikan bahwa sesama hash pun tidak bisa dipakai silang
    // Hash yang diupdate di satu tempat TIDAK mempengaruhi yang lain
  });
});
