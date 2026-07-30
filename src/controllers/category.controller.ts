import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as categoryService from '../services/category.service';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/errors';

const categorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
});

const idParamSchema = z.object({ id: z.string().length(36) });

export const createCategory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const category = await categoryService.createCategory(parsed.data as any);
  res.status(201).json(category);
});

export const getCategories = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const categories = await categoryService.listCategories();
  res.json(categories);
});

export const getCategoryById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const parsedParams = idParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ error: 'Invalid category id' });
  }

  const category = await categoryService.getCategoryById(parsedParams.data.id);
  res.json(category);
});

export const updateCategory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const parsedParams = idParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ error: 'Invalid category id' });
  }

  const parsedBody = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional().nullable(),
  }).safeParse(req.body);

  if (!parsedBody.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsedBody.error.flatten() });
  }

  const category = await categoryService.updateCategory(parsedParams.data.id, parsedBody.data as any);
  res.json(category);
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const parsedParams = idParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ error: 'Invalid category id' });
  }

  await categoryService.deleteCategory(parsedParams.data.id);
  res.status(204).send();
});
