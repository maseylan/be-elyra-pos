import { pgTable, text, timestamp, boolean, uuid, uniqueIndex, index, pgEnum, integer, jsonb, bigint, numeric } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Shared Schema (public)
// This file is used for platform-level configurations like Tenants and SuperAdmins.

export const applicationStatusEnum = pgEnum('application_status', ['pending', 'provisioned', 'expired', 'error']);

export const tenants = pgTable('tenants', {
  id: text('id').primaryKey(), // e.g. "tenant_abc123"
  name: text('name').notNull(),
  subdomain: text('subdomain').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  ownerName: text('owner_name').notNull(),
  whatsappNumber: text('whatsapp_number'),
  subscriptionType: text('subscription_type'), // 'starter', 'pro', 'enterprise'
  storageGb: numeric('storage_gb', { precision: 5, scale: 1 }).default('0.1').notNull(),
  subscriptionStart: timestamp('subscription_start'),
  nextBillingCycle: timestamp('next_billing_cycle'),
  applicationStatus: applicationStatusEnum('application_status').default('pending').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  databaseUrl: text('database_url'), // custom DB URL, null = default server
  schemaVersion: integer('schema_version').default(0), // migration tracking
  connectionPoolSize: integer('connection_pool_size').default(1), // pool max per tenant
  lastHealthCheckStatus: text('last_health_check_status'),
  lastHealthCheckAt: timestamp('last_health_check_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const superAdmins = pgTable('super_admins', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const superadminRefreshTokens = pgTable('superadmin_refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  superAdminId: text('super_admin_id').notNull().references(() => superAdmins.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  previousTokenHash: text('previous_token_hash'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  superAdminUnique: uniqueIndex('superadmin_refresh_tokens_super_admin_id_unique').on(table.superAdminId),
  tokenHashIdx: uniqueIndex('idx_superadmin_refresh_tokens_token_hash').on(table.tokenHash),
  previousTokenHashIdx: index('idx_superadmin_refresh_tokens_previous_hash').on(table.previousTokenHash),
}));

export const ownerBillingRefreshTokens = pgTable('owner_billing_refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  previousTokenHash: text('previous_token_hash'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantUnique: uniqueIndex('owner_billing_refresh_tokens_tenant_id_unique').on(table.tenantId),
  tokenHashIdx: uniqueIndex('idx_owner_billing_refresh_tokens_token_hash').on(table.tokenHash),
  previousTokenHashIdx: index('idx_owner_billing_refresh_tokens_previous_hash').on(table.previousTokenHash),
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
  planId: text('plan_id').notNull().references(() => subscriptionPlans.id),
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

export const tenantStats = pgTable('tenant_stats', {
  tenantId: text('tenant_id').primaryKey().references(() => tenants.id, { onDelete: 'cascade' }),
  apiRequestCount: bigint('api_request_count', { mode: 'number' }).notNull().default(0),
  lastBackupAt: timestamp('last_backup_at', { withTimezone: true }),
  uploadedFilesCount: integer('uploaded_files_count').notNull().default(0),
  fileStorageBytes: bigint('file_storage_bytes', { mode: 'number' }).notNull().default(0),
  totalProducts: integer('total_products').notNull().default(0),
  totalOrders: integer('total_orders').notNull().default(0),
  totalCustomers: integer('total_customers').notNull().default(0),
  totalUsers: integer('total_users').notNull().default(0),
  totalOutlets: integer('total_outlets').notNull().default(0),
  dbSizeBytes: bigint('db_size_bytes', { mode: 'number' }).notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const outgoingMails = pgTable('outgoing_mails', {
  id: text('id').primaryKey(),
  recipient: text('recipient').notNull(),
  subject: text('subject').notNull(),
  htmlContent: text('html_content').notNull(),
  status: text('status').notNull().default('pending'),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').notNull().default(0),
  tenantId: text('tenant_id').references(() => tenants.id),
  tenantName: text('tenant_name'),
  provider: text('provider').notNull().default('titan'),
  emailType: text('email_type').notNull().default('general'),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
