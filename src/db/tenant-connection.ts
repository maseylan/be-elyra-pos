import { Pool } from 'pg';
import { publicDb } from './poolManager';
import { tenants } from './schema';
import { eq } from 'drizzle-orm';
import { decryptDbUrl } from '../utils/dbUrlEncryption';

const DEFAULT_DB_URL = process.env.TENANT_DEFAULT_DB_URL || process.env.DATABASE_URL || '';
const MAX_POOLS = 100;
const IDLE_MS = 15 * 60 * 1000;

interface CachedPool {
  pool: Pool;
  lastUsed: number;
}

class TenantDbManager {
  private pools = new Map<string, CachedPool>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cleanupTimer = setInterval(() => this.evictIdle(), 60_000);
  }

  async getPool(tenantId: string): Promise<Pool> {
    const existing = this.pools.get(tenantId);
    if (existing) {
      existing.lastUsed = Date.now();
      return existing.pool;
    }

    const pool = await this.createPool(tenantId);
    this.pools.set(tenantId, { pool, lastUsed: Date.now() });
    this.evictLRU();
    return pool;
  }

  private async createPool(tenantId: string): Promise<Pool> {
    let connectionString: string;
    let poolSize = 1;

    const [tenant] = await publicDb.select({
      databaseUrl: tenants.databaseUrl,
      connectionPoolSize: tenants.connectionPoolSize,
    }).from(tenants).where(eq(tenants.id, tenantId));

    if (tenant?.databaseUrl) {
      connectionString = decryptDbUrl(tenant.databaseUrl);
    } else {
      if (!DEFAULT_DB_URL) throw new Error('TENANT_DEFAULT_DB_URL or DATABASE_URL must be set');
      const baseUrl = new URL(DEFAULT_DB_URL);
      baseUrl.pathname = `/${tenantId}`;
      connectionString = baseUrl.toString();
    }

    if (tenant?.connectionPoolSize && tenant.connectionPoolSize > 0) {
      poolSize = tenant.connectionPoolSize;
    }

    return new Pool({
      connectionString,
      max: poolSize,
      idleTimeoutMillis: IDLE_MS,
    });
  }

  private evictIdle() {
    const now = Date.now();
    for (const [id, entry] of this.pools) {
      if (now - entry.lastUsed > IDLE_MS) {
        entry.pool.end().catch(e => console.warn('[tenant-connection] evictIdle pool.end failed:', e));
        this.pools.delete(id);
      }
    }
  }

  private evictLRU() {
    if (this.pools.size <= MAX_POOLS) return;
    const entries = [...this.pools.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    const overflow = this.pools.size - MAX_POOLS;
    for (let i = 0; i < overflow; i++) {
      const [id] = entries[i];
      this.pools.get(id)?.pool.end().catch(e => console.warn('[tenant-connection] evictLRU pool.end failed:', e));
      this.pools.delete(id);
    }
  }

  async invalidate(tenantId: string) {
    const entry = this.pools.get(tenantId);
    if (entry) {
      await entry.pool.end().catch(e => console.warn('[tenant-connection] invalidate pool.end failed:', e));
      this.pools.delete(tenantId);
    }
  }

  async closeAll() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    for (const [id, entry] of this.pools) {
      await entry.pool.end().catch(e => console.warn('[tenant-connection] closeAll pool.end failed:', e));
      this.pools.delete(id);
    }
  }
}

export const tenantDbManager = new TenantDbManager();
