import { z } from 'zod';

const createProductSchema = z.object({
  sku: z.string().min(1).max(64),
  barcode: z.string().max(64).optional().nullable(),
  name: z.string().min(1).max(255),
  costPrice: z.number().nonnegative(),
  sellPrice: z.number().positive(),
  taxType: z.enum(['inclusive', 'exclusive', 'none']).default('none'),
  taxRate: z.number().min(0).max(100).optional().nullable(),
  trackStock: z.boolean().default(true),
  stock: z.number().int().min(0).optional().nullable(),
  unit: z.string().min(1).max(32).default('pcs'),
  lowStockThreshold: z.number().int().min(0).optional().nullable(),
  allowNegativeStock: z.boolean().default(false),
  categoryId: z.string().length(36).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
});

const payload = {
    "name": "ED",
    "sku": "Sd2",
    "costPrice": 332,
    "sellPrice": 2323,
    "taxType": "none",
    "trackStock": true,
    "stock": 12,
    "unit": "pcs",
    "lowStockThreshold": 9,
    "allowNegativeStock": true,
    "categoryId": "00000000-0000-0000-0000-000000000001"
};

const result = createProductSchema.safeParse(payload);
if (!result.success) {
    console.error(result.error.flatten());
} else {
    console.log("Success!");
}
