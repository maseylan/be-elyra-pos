import { pgTable, text, timestamp, boolean, uuid, uniqueIndex, pgEnum, integer, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Shared Schema (public)
// This file is used for platform-level configurations like Tenants and SuperAdmins.

export const applicationStatusEnum = pgEnum('application_status', ['pending', 'provisioned', 'expired']);

export const tenants = pgTable('tenants', {
  id: text('id').primaryKey(), // e.g. "tenant_abc123"
  name: text('name').notNull(),
  subdomain: text('subdomain').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  ownerName: text('owner_name').notNull(),
  whatsappNumber: text('whatsapp_number'),
  subscriptionType: text('subscription_type'), // 'starter', 'pro', 'enterprise'
  subscriptionStart: timestamp('subscription_start'),
  subscriptionEnd: timestamp('subscription_end'),
  applicationStatus: applicationStatusEnum('application_status').default('pending').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const superAdmins = pgTable('super_admins', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const superadminRefreshTokens = pgTable('superadmin_refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  superAdminId: text('super_admin_id').notNull().references(() => superAdmins.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  superAdminUnique: uniqueIndex('superadmin_refresh_tokens_super_admin_id_unique').on(table.superAdminId),
  tokenHashIdx: uniqueIndex('idx_superadmin_refresh_tokens_token_hash').on(table.tokenHash),
}));

export const ownerBillingRefreshTokens = pgTable('owner_billing_refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantUnique: uniqueIndex('owner_billing_refresh_tokens_tenant_id_unique').on(table.tenantId),
  tokenHashIdx: uniqueIndex('idx_owner_billing_refresh_tokens_token_hash').on(table.tokenHash),
}));

export const invoiceStatusEnum = pgEnum('invoice_status', ['pending', 'paid', 'overdue', 'cancelled']);

export const subscriptionPlans = pgTable('subscription_plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  priceMonthly: integer('price_monthly').notNull().default(0),
  priceYearly: integer('price_yearly'),
  features: jsonb('features').notNull().default([]),
  maxOutlets: integer('max_outlets'),
  maxProducts: integer('max_products'),
  maxAccounts: integer('max_accounts'),
  hasLoyalty: boolean('has_loyalty').default(false),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const invoices = pgTable('invoices', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  planId: text('plan_id').notNull(),
  amount: integer('amount').notNull(),
  status: invoiceStatusEnum('status').default('pending').notNull(),
  dueDate: timestamp('due_date'),
  paidAt: timestamp('paid_at'),
  periodStart: timestamp('period_start'),
  periodEnd: timestamp('period_end'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const paymentTransactions = pgTable('payment_transactions', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  amount: integer('amount').notNull(),
  method: text('method'),
  status: text('status').default('pending'),
  reference: text('reference'),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
