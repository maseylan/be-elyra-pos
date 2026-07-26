import { Request, Response } from 'express';
import { z } from 'zod';
import * as authService from '../services/auth.service';

const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Password harus diisi'),
  subdomain: z.string().optional()
});

export const ownerLogin = async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await authService.ownerLogin(data.email, data.password, data.subdomain);
    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validasi gagal', details: error.issues });
    }
    
    if (error.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ error: 'Kredensial tidak valid' });
    }
    
    if (error.message === 'ACCOUNT_DEACTIVATED') {
      return res.status(403).json({ error: 'Akun telah dinonaktifkan' });
    }

    console.error('Login error:', error);
    res.status(500).json({ error: 'Kesalahan server internal' });
  }
};
