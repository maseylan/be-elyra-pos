import { pgTable, text, timestamp, boolean, numeric, integer, varchar, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// This file is strictly for drizzle-kit to generate schema-agnostic SQL files for tenants.
// We use pgTable instead of pgSchema here so the generated SQL doesn't hardcode a schema name.
// When running migrations, the pool's search_path ensures these tables are created in the correct tenant schema.

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  role: text('role').notNull(),
  name: text('name').notNull(),
  email: text('email').unique(),
  passwordHash: text('password_hash'),
  pinHash: text('pin_hash'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const outlets = pgTable('outlets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code'),
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  logoUrl: text('logo_url'),
  businessMode: text('business_mode').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  isCustomConfig: boolean('is_custom_config').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  codeUnique: uniqueIndex('outlets_code_unique').on(table.code),
}));

export const tenantSettings = pgTable('tenant_settings', {
  id: text('id').primaryKey().default('default'),
  storeName: text('store_name').notNull(),
  storeAddress: text('store_address'),
  storePhone: text('store_phone'),
  defaultTaxRate: text('default_tax_rate').default('0'),
  taxType: text('tax_type').default('none'),
  receiptFooter: text('receipt_footer'),
  timezone: text('timezone').default('Asia/Jakarta'),
  currency: text('currency').default('IDR'),
  dateFormat: text('date_format').default('DD/MM/YYYY'),
  timeFormat: text('time_format').default('HH:mm'),
  allowSellingBelowCost: boolean('allow_selling_below_cost').default(false),
  allowNegativeStock: boolean('allow_negative_stock').default(false),
  requireCustomer: boolean('require_customer').default(false),
  autoGenerateOrderNumber: boolean('auto_generate_order_number').default(true),
  orderNumberingFormat: text('order_numbering_format').default('{OUTLET}-{YYYYMMDD}-{SEQ}'),
  roundingMethod: text('rounding_method').default('nearest_100'),
  decimalPrecision: integer('decimal_precision').default(0),
  orderSequenceReset: text('order_sequence_reset').default('daily'),
  paymentMethods: text('payment_methods'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const outletSettings = pgTable('outlet_settings', {
  id: text('id').primaryKey(),
  outletId: text('outlet_id').notNull().references(() => outlets.id, { onDelete: 'cascade' }).unique(),
  storeNameOverride: text('store_name_override'),
  storeAddressOverride: text('store_address_override'),
  storePhoneOverride: text('store_phone_override'),
  receiptFooterOverride: text('receipt_footer_override'),
  defaultTaxRateOverride: text('default_tax_rate_override'),
  taxTypeOverride: text('tax_type_override'),
  timezoneOverride: text('timezone_override'),
  currencyOverride: text('currency_override'),
  dateFormatOverride: text('date_format_override'),
  timeFormatOverride: text('time_format_override'),
  allowSellingBelowCostOverride: boolean('allow_selling_below_cost_override'),
  allowNegativeStockOverride: boolean('allow_negative_stock_override'),
  requireCustomerOverride: boolean('require_customer_override'),
  autoGenerateOrderNumberOverride: boolean('auto_generate_order_number_override'),
  orderNumberingFormatOverride: text('order_numbering_format_override'),
  roundingMethodOverride: text('rounding_method_override'),
  decimalPrecisionOverride: integer('decimal_precision_override'),
  orderSequenceResetOverride: text('order_sequence_reset_override'),
  paymentMethodsOverride: text('payment_methods_override'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const products = pgTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  price: numeric('price').notNull(),
  stock: integer('stock').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  idempotencyKey: text('idempotency_key').unique().notNull(),
  outletId: text('outlet_id').notNull().references(() => outlets.id),
  subtotal: numeric('subtotal').notNull(),
  taxAmount: numeric('tax_amount').notNull().default('0'),
  discountAmount: numeric('discount_amount').notNull().default('0'),
  totalAmount: numeric('total_amount').notNull(),
  paymentMethod: text('payment_method').notNull(),
  amountPaid: numeric('amount_paid').notNull(),
  changeAmount: numeric('change_amount').notNull(),
  tableNumber: text('table_number'),
  cashierId: text('cashier_id'),
  cashierName: text('cashier_name'),
  status: text('status').notNull(),
  memberId: text('member_id').references(() => loyaltyMembers.id, { onDelete: 'set null' }),
  couponId: text('coupon_id').references(() => loyaltyCoupons.id, { onDelete: 'set null' }),
  redeemedRewardId: text('redeemed_reward_id').references(() => loyaltyRewards.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const orderItems = pgTable('order_items', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id),
  productId: text('product_id').notNull().references(() => products.id),
  productName: text('product_name'),
  quantity: integer('quantity').notNull(),
  price: numeric('price').notNull(),
  subtotal: numeric('subtotal').notNull(),
  notes: text('notes'),
});

export const floorPlans = pgTable('floor_plans', {
  id: text('id').primaryKey(),
  outletId: text('outlet_id').notNull().references(() => outlets.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  width: integer('width').default(1200),
  height: integer('height').default(800),
  gridSize: integer('grid_size').default(40),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tables = pgTable('tables', {
  id: text('id').primaryKey(),
  floorPlanId: text('floor_plan_id').notNull().references(() => floorPlans.id, { onDelete: 'cascade' }),
  number: text('number').notNull(),
  capacity: integer('capacity').default(4),
  shape: text('shape').default('circle'),
  posX: integer('pos_x').default(0),
  posY: integer('pos_y').default(0),
  width: integer('width').default(80),
  height: integer('height').default(80),
  status: text('status').default('Empty').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const customers = pgTable('customers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  phoneUnique: uniqueIndex('customers_phone_unique').on(table.phone),
}));

export const loyaltyPrograms = pgTable('loyalty_programs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  pointsPerUnit: integer('points_per_unit').notNull().default(1),
  unitAmount: integer('unit_amount').notNull().default(1000),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const outletLoyaltyPrograms = pgTable('outlet_loyalty_programs', {
  id: text('id').primaryKey(),
  outletId: text('outlet_id').notNull().references(() => outlets.id, { onDelete: 'cascade' }),
  programId: text('program_id').notNull().references(() => loyaltyPrograms.id, { onDelete: 'cascade' }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueOutletProgram: uniqueIndex('outlet_loyalty_programs_unique').on(table.outletId, table.programId),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }).unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyMemberPrograms = pgTable('loyalty_member_programs', {
  id: text('id').primaryKey(),
  memberId: text('member_id').notNull().references(() => loyaltyMembers.id, { onDelete: 'cascade' }),
  programId: text('program_id').notNull().references(() => loyaltyPrograms.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueMemberProgram: uniqueIndex('loyalty_member_programs_unique').on(table.memberId, table.programId),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: text('id').primaryKey(),
  programId: text('program_id').notNull().references(() => loyaltyPrograms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(),
  pointsCost: integer('points_cost').notNull(),
  value: text('value').notNull(),
  maxDiscount: text('max_discount'),
  productId: text('product_id').references(() => products.id, { onDelete: 'set null' }),
  stock: integer('stock'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const loyaltyRewardRedemptions = pgTable('loyalty_reward_redemptions', {
  id: text('id').primaryKey(),
  rewardId: text('reward_id').notNull().references(() => loyaltyRewards.id, { onDelete: 'cascade' }),
  memberId: text('member_id').notNull().references(() => loyaltyMembers.id, { onDelete: 'cascade' }),
  orderId: text('order_id').references(() => orders.id, { onDelete: 'set null' }),
  programId: text('program_id').notNull(),
  pointsCost: integer('points_cost').notNull(),
  status: text('status').notNull().default('pending'),
  claimedAt: timestamp('claimed_at'),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyCoupons = pgTable('loyalty_coupons', {
  id: text('id').primaryKey(),
  programId: text('program_id').references(() => loyaltyPrograms.id, { onDelete: 'set null' }),
  code: text('code').notNull().unique(),
  type: text('type').notNull(),
  value: text('value').notNull(),
  maxDiscount: text('max_discount'),
  productId: text('product_id').references(() => products.id, { onDelete: 'set null' }),
  minPurchase: text('min_purchase'),
  usageLimit: integer('usage_limit'),
  usedCount: integer('used_count').notNull().default(0),
  validFrom: timestamp('valid_from'),
  validUntil: timestamp('valid_until'),
  isActive: boolean('is_active').default(true).notNull(),
  isSingleUse: boolean('is_single_use').default(false).notNull(),
  memberId: text('member_id').references(() => loyaltyMembers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const loyaltyCouponUsages = pgTable('loyalty_coupon_usages', {
  id: text('id').primaryKey(),
  couponId: text('coupon_id').notNull().references(() => loyaltyCoupons.id, { onDelete: 'cascade' }),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  memberId: text('member_id').references(() => loyaltyMembers.id, { onDelete: 'set null' }),
  discountAmount: text('discount_amount').notNull(),
  usedAt: timestamp('used_at').defaultNow().notNull(),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userUnique: uniqueIndex('refresh_tokens_user_id_unique').on(table.userId),
  tokenHashIdx: uniqueIndex('idx_refresh_tokens_token_hash').on(table.tokenHash),
}));

export const loyaltyPointsTransactions = pgTable('loyalty_points_transactions', {
  id: text('id').primaryKey(),
  memberId: text('member_id').notNull().references(() => loyaltyMembers.id, { onDelete: 'cascade' }),
  programId: text('program_id').notNull().references(() => loyaltyPrograms.id, { onDelete: 'cascade' }),
  orderId: text('order_id').references(() => orders.id, { onDelete: 'set null' }),
  outletId: text('outlet_id').notNull().references(() => outlets.id, { onDelete: 'cascade' }),
  points: integer('points').notNull(),
  type: text('type').notNull(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
