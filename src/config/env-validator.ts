const REQUIRED_ENV_VARS = [
  'JWT_SECRET',
  'DB_URL_ENCRYPTION_KEY',
  'DATABASE_URL',
  'REDIS_URL',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'FRONTEND_URL',
  'ROOT_DOMAIN',
];

export function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error(`[env-validator] Missing required environment variables:\n  ${missing.join('\n  ')}`);
    process.exit(1);
  }
  console.log('[env-validator] All required environment variables present');
}
