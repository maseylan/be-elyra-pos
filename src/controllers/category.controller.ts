import { Request, Response } from 'express';
import { z } from 'zod';
import * as categoryService from '../services/category.service';
import { CategoryNotFoundError } from '../services/category.service';

const categorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
});

const idParamSchema = z.object({ id: z.string().length(36) });

export const createCategory = async (req: Request, res: Response) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  try {
    const category = await categoryService.createCategory(parsed.data as any);
    res.status(201).json(category);
  } catch (error) {
    console.error('Failed to create category', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
};

export const getCategories = async (req: Request, res: Response) => {
  try {
    const categories = await categoryService.listCategories();
    res.json(categories);
  } catch (error) {
    console.error('Failed to fetch categories', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

export const getCategoryById = async (req: Request, res: Response) => {
  const parsedParams = idParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ error: 'Invalid category id' });
  }
  
  try {
    const category = await categoryService.getCategoryById(parsedParams.data.id);
    res.json(category);
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Failed to fetch category detail', error);
    res.status(500).json({ error: 'Failed to fetch category detail' });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
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

  try {
    const category = await categoryService.updateCategory(parsedParams.data.id, parsedBody.data as any);
    res.json(category);
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Failed to update category', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  const parsedParams = idParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ error: 'Invalid category id' });
  }

  try {
    await categoryService.deleteCategory(parsedParams.data.id);
    res.status(204).send();
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Failed to delete category', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
};
