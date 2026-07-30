import { Request, Response } from 'express';
import { z } from 'zod';
import * as authService from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/errors';

const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Password harus diisi'),
  subdomain: z.string().optional()
});

export const ownerLogin = asyncHandler(async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await authService.ownerLogin(data.email, data.password, data.subdomain);
    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) throw error;
    if (error.message === 'INVALID_CREDENTIALS') throw error;
    if (error.message === 'ACCOUNT_DEACTIVATED') throw new HttpError(403, error.message);
    throw error;
  }
});
