import { pgTable, text, timestamp, boolean, numeric, integer, uuid, varchar, decimal, jsonb, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// Existing tables
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  role: text('role').notNull(), // 'cashier', 'supervisor', 'admin', 'owner'
  name: text('name').notNull(),
  email: text('email').unique(), // For admin/owner
  passwordHash: text('password_hash'),
  pinHash: text('pin_hash'), // For cashier PIN
  isActive: boolean('is_active').default(true).notNull(),
  isAllOutlets: boolean('is_all_outlets').notNull().default(false), // true untuk owner/admin
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const outlets = pgTable('outlets', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 20 }),
  address: text('address'),
  phone: varchar('phone', { length: 30 }),
  email: varchar('email', { length: 100 }),
  logoUrl: text('logo_url'),
  businessMode: text('business_mode').notNull(), // 'retail' | 'fnb'
  isActive: boolean('is_active').notNull().default(true),
  isCustomConfig: boolean('is_custom_config').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  codeUnique: uniqueIndex('outlets_code_unique').on(table.code),
}));

// Product Module Enums
export const taxTypeEnum = pgEnum('tax_type', ['inclusive', 'exclusive', 'none']);
export const productTypeEnum = pgEnum('product_type', ['STOCK', 'NON_STOCK', 'SERVICES']);
export const stockMovementTypeEnum = pgEnum('stock_movement_type', [
  'sale', 'restock', 'adjustment', 'waste', 'return', 'initial'
]);

export const userOutlets = pgTable('user_outlets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  outletId: uuid('outlet_id').notNull().references(() => outlets.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  uniqueUserOutlet: uniqueIndex('user_outlets_unique').on(table.userId, table.outletId),
}));

export const tenantSettings = pgTable('tenant_settings', {
  id: text('id').primaryKey().default('default'), // single row
  storeName: varchar('store_name', { length: 100 }).notNull(),
  storeAddress: text('store_address'),
  storePhone: varchar('store_phone', { length: 30 }),
  defaultTaxRate: decimal('default_tax_rate', { precision: 5, scale: 2 }).default('0'),
  taxType: taxTypeEnum('tax_type').default('none'),
  receiptFooter: text('receipt_footer'),

  // Regional preferences
  timezone: varchar('timezone', { length: 50 }).default('Asia/Jakarta'),
  currency: varchar('currency', { length: 10 }).default('IDR'),
  dateFormat: varchar('date_format', { length: 20 }).default('DD/MM/YYYY'),
  timeFormat: varchar('time_format', { length: 10 }).default('HH:mm'),

  // POS policies
  allowSellingBelowCost: boolean('allow_selling_below_cost').default(false),
  allowNegativeStock: boolean('allow_negative_stock').default(false),
  requireCustomer: boolean('require_customer').default(false),
  autoGenerateOrderNumber: boolean('auto_generate_order_number').default(true),
  orderNumberingFormat: varchar('order_numbering_format', { length: 50 }).default('{OUTLET}-{YYYYMMDD}-{SEQ}'),
  roundingMethod: varchar('rounding_method', { length: 20 }).default('nearest_100'),
  decimalPrecision: integer('decimal_precision').default(0),

  // Sequence
  orderSequenceReset: varchar('order_sequence_reset', { length: 10 }).default('daily'),

  // Payment methods
  paymentMethods: jsonb('payment_methods'),

  promotionTaxMode: varchar('promotion_tax_mode', { length: 10 }).default('after_tax'),

  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const outletSettings = pgTable('outlet_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  outletId: uuid('outlet_id').notNull().references(() => outlets.id, { onDelete: 'cascade' }).unique(),

  storeNameOverride: varchar('store_name_override', { length: 100 }), 
  storeAddressOverride: text('store_address_override'), 
  storePhoneOverride: varchar('store_phone_override', { length: 30 }),
  receiptFooterOverride: text('receipt_footer_override'),

  // Tax overrides
  defaultTaxRateOverride: decimal('default_tax_rate_override', { precision: 5, scale: 2 }),
  taxTypeOverride: varchar('tax_type_override', { length: 10 }),

  // Regional overrides
  timezoneOverride: varchar('timezone_override', { length: 50 }),
  currencyOverride: varchar('currency_override', { length: 10 }),
  dateFormatOverride: varchar('date_format_override', { length: 20 }),
  timeFormatOverride: varchar('time_format_override', { length: 10 }),

  // POS policy overrides
  allowSellingBelowCostOverride: boolean('allow_selling_below_cost_override'),
  allowNegativeStockOverride: boolean('allow_negative_stock_override'),
  requireCustomerOverride: boolean('require_customer_override'),
  autoGenerateOrderNumberOverride: boolean('auto_generate_order_number_override'),
  orderNumberingFormatOverride: varchar('order_numbering_format_override', { length: 50 }),
  roundingMethodOverride: varchar('rounding_method_override', { length: 20 }),
  decimalPrecisionOverride: integer('decimal_precision_override'),

  // Sequence override
  orderSequenceResetOverride: varchar('order_sequence_reset_override', { length: 10 }),

  // Payment methods override
  paymentMethodsOverride: jsonb('payment_methods_override'),

  promotionTaxModeOverride: varchar('promotion_tax_mode_override', { length: 10 }),

  // Floor plan override
  activeFloorPlanIds: jsonb('active_floor_plan_ids').$type<string[]>(),

  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Product Module Tables
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  sku: varchar('sku', { length: 64 }).notNull(),
  barcode: varchar('barcode', { length: 64 }),
  name: varchar('name', { length: 255 }).notNull(),

  costPrice: decimal('cost_price', { precision: 12, scale: 2 }).notNull().default('0'),
  sellPrice: decimal('sell_price', { precision: 12, scale: 2 }).notNull(),
  taxType: taxTypeEnum('tax_type').notNull().default('none'),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }),

  type: productTypeEnum('type').notNull().default('STOCK'),
  trackStock: boolean('track_stock'),
  unit: varchar('unit', { length: 32 }).notNull().default('pcs'),
  lowStockThreshold: integer('low_stock_threshold'),
  allowNegativeStock: boolean('allow_negative_stock'),

  categoryId: uuid('category_id').references(() => categories.id),

  isGlobal: boolean('is_global').notNull().default(true),
  hasVariants: boolean('has_variants').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  imageUrl: text('image_url'),

  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  skuUnique: uniqueIndex('products_sku_unique').on(table.sku),
  barcodeUnique: uniqueIndex('products_barcode_unique').on(table.barcode),
}));

// 1. Base Product Variants
export const productVariants = pgTable('product_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  price: decimal('price', { precision: 12, scale: 2 }).notNull().default('0'),
  sku: varchar('sku', { length: 64 }),
  isDefault: boolean('is_default').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const outletProducts = pgTable('outlet_products', {
  id: uuid('id').primaryKey().defaultRandom(),
  outletId: uuid('outlet_id').notNull().references(() => outlets.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),

  stock: integer('stock').notNull().default(0),
  sellPriceOverride: decimal('sell_price_override', { precision: 12, scale: 2 }), // null = pakai products.sellPrice / productVariants.price
  lowStockThreshold: integer('low_stock_threshold'), // null = fallback ke products.lowStockThreshold
  isAvailable: boolean('is_available').notNull().default(true),

  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  uniqueOutletProduct: uniqueIndex('outlet_products_unique').on(table.outletId, table.productId, table.variantId),
}));

export const stockMovements = pgTable('stock_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  outletId: uuid('outlet_id').notNull().references(() => outlets.id),
  productId: uuid('product_id').notNull().references(() => products.id),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),
  type: stockMovementTypeEnum('type').notNull(),
  quantityChange: integer('quantity_change').notNull(),
  stockAfter: integer('stock_after').notNull(),
  referenceId: uuid('reference_id'),
  note: varchar('note', { length: 255 }),
  reason: varchar('reason', { length: 255 }),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// 3. Modifier Groups
export const modifierGroups = pgTable('modifier_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  selectionType: varchar('selection_type', { length: 20 }).notNull().default('single'),
  minSelect: integer('min_select').notNull().default(0),
  maxSelect: integer('max_select'),
  isRequired: boolean('is_required').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// 4. Modifiers (No stock column)
export const modifiers = pgTable('modifiers', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => modifierGroups.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  priceAdjustment: decimal('price_adjustment', { precision: 12, scale: 2 }).notNull().default('0'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// 5. Outlet Modifier Overrides (No stock column)
export const outletModifiers = pgTable('outlet_modifiers', {
  id: uuid('id').primaryKey().defaultRandom(),
  outletId: uuid('outlet_id').notNull().references(() => outlets.id, { onDelete: 'cascade' }),
  modifierId: uuid('modifier_id').notNull().references(() => modifiers.id, { onDelete: 'cascade' }),
  priceAdjustment: decimal('price_adjustment', { precision: 12, scale: 2 }),
  isAvailable: boolean('is_available').notNull().default(true),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  uniqueOutletModifier: uniqueIndex('outlet_modifiers_unique').on(table.outletId, table.modifierId),
}));

// 6. Global Add-ons
export const addOns = pgTable('add_ons', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  price: decimal('price', { precision: 12, scale: 2 }).notNull().default('0'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  uniqueAddOnName: uniqueIndex('add_ons_name_unique').on(table.name),
}));

// 7. Product ↔ Add-on Junction Table
export const productAddOns = pgTable('product_add_ons', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  addOnId: uuid('add_on_id').notNull().references(() => addOns.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  uniqueProductAddOn: uniqueIndex('product_add_ons_unique').on(table.productId, table.addOnId),
}));

// 8. Outlet Add-on Overrides
export const outletAddOns = pgTable('outlet_add_ons', {
  id: uuid('id').primaryKey().defaultRandom(),
  outletId: uuid('outlet_id').notNull().references(() => outlets.id, { onDelete: 'cascade' }),
  addOnId: uuid('add_on_id').notNull().references(() => addOns.id, { onDelete: 'cascade' }),
  price: decimal('price', { precision: 12, scale: 2 }),
  stock: integer('stock'),
  isAvailable: boolean('is_available').notNull().default(true),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  uniqueOutletAddOn: uniqueIndex('outlet_add_ons_unique').on(table.outletId, table.addOnId),
}));

// Cashier Register Sessions
export const cashierSessions = pgTable('cashier_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  outletId: uuid('outlet_id').notNull().references(() => outlets.id, { onDelete: 'restrict' }),
  cashierId: uuid('cashier_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  cashierName: varchar('cashier_name', { length: 100 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('OPEN'),
  openedAt: timestamp('opened_at').notNull().defaultNow(),
  closedAt: timestamp('closed_at'),
  startingCash: decimal('starting_cash', { precision: 12, scale: 2 }).notNull().default('0'),
  endingCash: decimal('ending_cash', { precision: 12, scale: 2 }),
  expectedCash: decimal('expected_cash', { precision: 12, scale: 2 }),
  cashDifference: decimal('cash_difference', { precision: 12, scale: 2 }),
  paymentBreakdown: jsonb('payment_breakdown').default({}),
  totalRefunds: decimal('total_refunds', { precision: 12, scale: 2 }).default('0'),
  totalOrdersCount: integer('total_orders_count').default(0),
  closedBy: uuid('closed_by').references(() => users.id, { onDelete: 'set null' }),
  forceClosedReason: text('force_closed_reason'),
  notes: text('notes'),
  closingNotes: text('closing_notes'),
  settingsSnapshot: jsonb('settings_snapshot').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Orders & Items
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  idempotencyKey: text('idempotency_key').unique().notNull(),
  outletId: uuid('outlet_id').notNull().references(() => outlets.id, { onDelete: 'restrict' }),
  sessionId: uuid('session_id').references(() => cashierSessions.id, { onDelete: 'restrict' }),
  subtotal: numeric('subtotal').notNull(),
  taxAmount: numeric('tax_amount').notNull().default('0'),
  discountAmount: numeric('discount_amount').notNull().default('0'),
  totalAmount: numeric('total_amount').notNull(),
  paymentMethod: text('payment_method').notNull(),
  amountPaid: numeric('amount_paid').notNull(),
  changeAmount: numeric('change_amount').notNull(),
  tableNumber: varchar('table_number', { length: 10 }),
  cashierId: uuid('cashier_id').references(() => users.id, { onDelete: 'set null' }),
  cashierName: text('cashier_name'),
  orderNumber: varchar('order_number', { length: 50 }),
  roundingAmount: numeric('rounding_amount').notNull().default('0'),
  status: text('status').notNull(),
  memberId: uuid('member_id').references(() => loyaltyMembers.id, { onDelete: 'set null' }),
  couponId: uuid('coupon_id').references(() => loyaltyCoupons.id, { onDelete: 'set null' }),
  redeemedRewardId: uuid('redeemed_reward_id').references(() => loyaltyRewards.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  orderNumberUnique: uniqueIndex('idx_orders_outlet_order_number').on(table.outletId, table.orderNumber),
}));

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  productName: varchar('product_name', { length: 255 }),
  quantity: integer('quantity').notNull(),
  price: numeric('price').notNull(),
  subtotal: numeric('subtotal').notNull(),
  notes: text('notes'),
});

// Floor Plans & Tables
export const floorPlans = pgTable('floor_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  outletId: uuid('outlet_id').notNull().references(() => outlets.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  width: integer('width').default(1200),
  height: integer('height').default(800),
  gridSize: integer('grid_size').default(40),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tables = pgTable('tables', {
  id: uuid('id').primaryKey().defaultRandom(),
  floorPlanId: uuid('floor_plan_id').notNull().references(() => floorPlans.id, { onDelete: 'cascade' }),
  number: varchar('number', { length: 10 }).notNull(),
  capacity: integer('capacity').default(4),
  shape: varchar('shape', { length: 20 }).default('circle'),
  posX: integer('pos_x').default(0),
  posY: integer('pos_y').default(0),
  width: integer('width').default(80),
  height: integer('height').default(80),
  status: varchar('status', { length: 20 }).default('Empty').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Customers (standalone, base for loyalty_members)
export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 30 }).notNull(),
  email: varchar('email', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  phoneUnique: uniqueIndex('customers_phone_unique').on(table.phone),
}));

export const loyaltyPrograms = pgTable('loyalty_programs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  pointsPerUnit: integer('points_per_unit').notNull().default(1),
  unitAmount: integer('unit_amount').notNull().default(1000),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const outletLoyaltyPrograms = pgTable('outlet_loyalty_programs', {
  id: uuid('id').primaryKey().defaultRandom(),
  outletId: uuid('outlet_id').notNull().references(() => outlets.id, { onDelete: 'cascade' }),
  programId: uuid('program_id').notNull().references(() => loyaltyPrograms.id, { onDelete: 'cascade' }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueOutletProgram: uniqueIndex('outlet_loyalty_programs_unique').on(table.outletId, table.programId),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }).unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyMemberPrograms = pgTable('loyalty_member_programs', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberId: uuid('member_id').notNull().references(() => loyaltyMembers.id, { onDelete: 'cascade' }),
  programId: uuid('program_id').notNull().references(() => loyaltyPrograms.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueMemberProgram: uniqueIndex('loyalty_member_programs_unique').on(table.memberId, table.programId),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: uuid('id').primaryKey().defaultRandom(),
  programId: uuid('program_id').notNull().references(() => loyaltyPrograms.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 30 }).notNull(),
  pointsCost: integer('points_cost').notNull(),
  value: decimal('value', { precision: 12, scale: 2 }).notNull(),
  maxDiscount: decimal('max_discount', { precision: 12, scale: 2 }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  stock: integer('stock'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const loyaltyRewardRedemptions = pgTable('loyalty_reward_redemptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  rewardId: uuid('reward_id').notNull().references(() => loyaltyRewards.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').notNull().references(() => loyaltyMembers.id, { onDelete: 'cascade' }),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
  programId: uuid('program_id').notNull().references(() => loyaltyPrograms.id),
  pointsCost: integer('points_cost').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  claimedAt: timestamp('claimed_at'),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyCoupons = pgTable('loyalty_coupons', {
  id: uuid('id').primaryKey().defaultRandom(),
  programId: uuid('program_id').references(() => loyaltyPrograms.id, { onDelete: 'set null' }),
  code: varchar('code', { length: 50 }).notNull().unique(),
  type: varchar('type', { length: 30 }).notNull(),
  value: decimal('value', { precision: 12, scale: 2 }).notNull(),
  maxDiscount: decimal('max_discount', { precision: 12, scale: 2 }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  minPurchase: decimal('min_purchase', { precision: 12, scale: 2 }),
  usageLimit: integer('usage_limit'),
  usedCount: integer('used_count').notNull().default(0),
  validFrom: timestamp('valid_from'),
  validUntil: timestamp('valid_until'),
  isActive: boolean('is_active').default(true).notNull(),
  isSingleUse: boolean('is_single_use').default(false).notNull(),
  memberId: uuid('member_id').references(() => loyaltyMembers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const loyaltyCouponUsages = pgTable('loyalty_coupon_usages', {
  id: uuid('id').primaryKey().defaultRandom(),
  couponId: uuid('coupon_id').notNull().references(() => loyaltyCoupons.id, { onDelete: 'cascade' }),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').references(() => loyaltyMembers.id, { onDelete: 'set null' }),
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).notNull(),
  usedAt: timestamp('used_at').defaultNow().notNull(),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  previousTokenHash: text('previous_token_hash'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userUnique: uniqueIndex('refresh_tokens_user_id_unique').on(table.userId),
  tokenHashIdx: uniqueIndex('idx_refresh_tokens_token_hash').on(table.tokenHash),
  previousTokenHashIdx: index('idx_refresh_tokens_previous_hash').on(table.previousTokenHash),
}));

export const loyaltyPointsTransactions = pgTable('loyalty_points_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberId: uuid('member_id').notNull().references(() => loyaltyMembers.id, { onDelete: 'cascade' }),
  programId: uuid('program_id').notNull().references(() => loyaltyPrograms.id, { onDelete: 'cascade' }),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
  outletId: uuid('outlet_id').notNull().references(() => outlets.id, { onDelete: 'cascade' }),
  points: integer('points').notNull(),
  type: varchar('type', { length: 10 }).notNull(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const promotionPrograms = pgTable('promotion_programs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  promotionType: varchar('promotion_type', { length: 20 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  value: decimal('value', { precision: 12, scale: 2 }).notNull(),
  maxDiscount: decimal('max_discount', { precision: 12, scale: 2 }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  minPurchase: decimal('min_purchase', { precision: 12, scale: 2 }),
  validFrom: timestamp('valid_from'),
  validUntil: timestamp('valid_until'),
  isActive: boolean('is_active').default(true).notNull(),
  buyQty: integer('buy_qty'),
  getQty: integer('get_qty'),
  code: varchar('code', { length: 50 }).unique(),
  usageLimit: integer('usage_limit'),
  usedCount: integer('used_count').default(0).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const promotionOutlets = pgTable('promotion_outlets', {
  id: uuid('id').primaryKey().defaultRandom(),
  promotionId: uuid('promotion_id').notNull().references(() => promotionPrograms.id, { onDelete: 'cascade' }),
  outletId: uuid('outlet_id').notNull().references(() => outlets.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniquePromotionOutlet: uniqueIndex('promotion_outlets_unique').on(table.promotionId, table.outletId),
}));
