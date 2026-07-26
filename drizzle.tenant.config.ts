import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/tenant_schema.ts',
  out: './drizzle/tenant',
  dialect: 'postgresql',
});
