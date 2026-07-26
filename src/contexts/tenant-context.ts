import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContextData {
  schemaName: string;
  tenantId: string;
  status: string;
  subscriptionType: string;
  subscriptionEnd?: string;
  outletId?: string;
}

export const tenantContext = new AsyncLocalStorage<TenantContextData>();

export const getCurrentTenant = (): TenantContextData => {
  const ctx = tenantContext.getStore();
  if (!ctx) {
    throw new Error('Tenant context is missing. Ensure this is called within a tenant-resolved request.');
  }
  return ctx;
};
