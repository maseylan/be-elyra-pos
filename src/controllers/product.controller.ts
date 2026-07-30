import { Request, Response } from 'express';
import { z } from 'zod';
import * as productService from '../services/product.service';
import * as outletProductService from '../services/outlet-product.service';
import { HttpError } from '../utils/errors';
import { asyncHandler } from '../utils/asyncHandler';

const createProductSchema = z.object({
  sku: z.string().min(1).max(64),
  barcode: z.string().max(64).nullable().optional(),
  name: z.string().min(1).max(255),
  costPrice: z.number().nonnegative(),
  sellPrice: z.number().positive(),
  taxType: z.enum(['inclusive', 'exclusive', 'none']).default('none'),
  taxRate: z.number().min(0).max(100).optional().nullable(),
  type: z.enum(['STOCK', 'NON_STOCK', 'SERVICES']).default('STOCK'),
  trackStock: z.boolean().optional().nullable(),
  stock: z.number().int().min(0).optional().nullable(),
  unit: z.string().min(1).max(32).default('pcs'),
  lowStockThreshold: z.number().int().min(0).optional().nullable(),
  allowNegativeStock: z.boolean().optional().nullable(),
  categoryId: z.string().length(36).optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  isGlobal: z.boolean().default(true),
  outletIds: z.array(z.string().length(36)).optional(),
  variants: z.array(z.object({
    name: z.string().min(1).max(100),
    price: z.number().nonnegative(),
    sku: z.string().max(64).optional().nullable(),
    isDefault: z.boolean().optional(),
  })).optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  categoryId: z.string().length(36).optional(),
  includeImages: z.string().default('true').transform(v => v === 'true'),
  status: z.string().optional().default('ACTIVE'),
});

const idParamSchema = z.object({ id: z.string().length(36) });

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
  }
  const outletId = (req as any).outletId;
  let products;
  if (outletId) {
    products = await outletProductService.listProductsForOutlet(outletId, parsed.data);
  } else {
    products = await productService.listProducts(parsed.data);
  }
  res.json(products);
});

export const getProductById = asyncHandler(async (req: Request, res: Response) => {
  const parsedParams = idParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ error: 'Invalid product id' });
  }
  const outletId = (req.query.outletId as string) || (req.params as any).outletId || (req as any).outletId;
  const product = await productService.getProductById(parsedParams.data.id, outletId);
  res.json(product);
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const outletId = (req as any).outletId;
  const isGlobal = outletId ? false : parsed.data.isGlobal;
  const outletIds = outletId ? [outletId] : parsed.data.outletIds;

  try {
    const product = await productService.createProduct({
      ...parsed.data,
      isGlobal,
      outletIds,
      createdBy: (req as any).user?.id || (req as any).user?.userId,
    } as any);
    res.status(201).json(product);
  } catch (error: any) {
    if (error.code === '23505') throw new HttpError(400, 'SKU atau barcode produk sudah digunakan');
    if (error.code === '23503') throw new HttpError(400, 'Kategori atau referensi produk tidak ditemukan');
    throw error;
  }
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const parsedParams = idParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ error: 'Invalid product id' });
  }

  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }

  const product = await productService.updateProduct(parsedParams.data.id, {
    ...parsed.data,
    updatedBy: (req as any).user?.id || (req as any).user?.userId,
  } as any);
  res.json(product);
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const parsedParams = idParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ error: 'Invalid product id' });
  }
  await productService.deleteProduct(parsedParams.data.id);
  res.json({ success: true });
});
