import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContextData {
  tenantId: string;
  status: string;
  subscriptionType: string;
  nextBillingCycle?: string;
  isActive: boolean;
}

export const tenantContext = new AsyncLocalStorage<TenantContextData>();

export const getCurrentTenant = (): TenantContextData => {
  const ctx = tenantContext.getStore();
  if (!ctx) {
    throw new Error('Tenant context is missing. Ensure this is called within a tenant-resolved request.');
  }
  return ctx;
};
