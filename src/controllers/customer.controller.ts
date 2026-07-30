import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as customerService from '../services/customer.service';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/errors';

const listQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const paramSchema = z.object({
  id: z.string().uuid(),
});

const adjustPointsSchema = z.object({
  programId: z.string().uuid(),
  points: z.number().int(),
  reason: z.string().min(1),
});

const createCustomerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
});

const enrollSchema = z.object({
  programId: z.string().uuid(),
});

export const listCustomers = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const query = listQuerySchema.safeParse(req.query);
  if (!query.success) {
    return res.status(400).json({ error: 'Invalid query', details: query.error.flatten() });
  }

  const result = await customerService.listCustomers(query.data);
  res.json(result);
});

export const getCustomer = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const params = paramSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ error: 'Invalid customer id' });
  }

  const customer = await customerService.getCustomerById(params.data.id);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }
  res.json(customer);
});

export const adjustCustomerPoints = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const params = paramSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ error: 'Invalid customer id' });
  }

  const body = adjustPointsSchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: 'Invalid payload', details: body.error.flatten() });
  }

  const outletId = (req as any).outletId;
  if (!outletId) {
    return res.status(400).json({ error: 'Outlet context required' });
  }

  try {
    const result = await customerService.adjustPoints(
      params.data.id,
      body.data.programId,
      body.data.points,
      body.data.reason,
      outletId,
      (req as any).user?.id,
    );
    res.json(result);
  } catch (error: any) {
    if (error?.message?.includes('not found')) throw new HttpError(404, error.message);
    throw error;
  }
});

export const enrollCustomer = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const params = paramSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ error: 'Invalid customer id' });
  }

  const body = enrollSchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: 'Invalid payload', details: body.error.flatten() });
  }

  try {
    const enrollment = await customerService.enrollCustomerInProgram(params.data.id, body.data.programId);
    res.status(201).json(enrollment);
  } catch (error: any) {
    if (error?.message?.includes('not found')) throw new HttpError(404, error.message);
    if (error?.message?.includes('already enrolled')) throw new HttpError(409, error.message);
    throw error;
  }
});

export const createCustomer = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const body = createCustomerSchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: 'Invalid payload', details: body.error.flatten() });
  }

  try {
    const customer = await customerService.createCustomer({
      name: body.data.name,
      phone: body.data.phone,
      email: body.data.email || undefined,
    });
    res.status(201).json(customer);
  } catch (error: any) {
    if (error?.message?.includes('already exists')) throw new HttpError(409, error.message);
    throw error;
  }
});
