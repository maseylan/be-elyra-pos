import redisClient from '../config/redis';
import { HttpError } from '../utils/errors';

const MAX_PASSWORD_ATTEMPTS = 5;
const MAX_PIN_ATTEMPTS = 3;
const LOCKOUT_DURATION_SECONDS = 5 * 60;
const ATTEMPT_WINDOW_SECONDS = 15 * 60;

function attemptsKey(scope: string, identifier: string): string {
  return `login:attempts:${scope}:${identifier}`;
}

function lockoutKey(scope: string, identifier: string): string {
  return `login:lockout:${scope}:${identifier}`;
}

export async function checkLoginLockout(scope: string, identifier: string): Promise<void> {
  const isLocked = await redisClient.get(lockoutKey(scope, identifier));
  if (isLocked) {
    const ttl = await redisClient.ttl(lockoutKey(scope, identifier));
    throw new HttpError(429,
      `Terlalu banyak percobaan gagal. Coba lagi dalam ${Math.ceil(ttl / 60)} menit.`
    );
  }
}

export async function recordFailedLogin(scope: string, identifier: string, isPin: boolean = false): Promise<void> {
  const maxAttempts = isPin ? MAX_PIN_ATTEMPTS : MAX_PASSWORD_ATTEMPTS;
  const aKey = attemptsKey(scope, identifier);
  const lKey = lockoutKey(scope, identifier);

  const attempts = await redisClient.incr(aKey);
  if (attempts === 1) {
    await redisClient.expire(aKey, ATTEMPT_WINDOW_SECONDS);
  }

  if (attempts >= maxAttempts) {
    await redisClient.setEx(lKey, LOCKOUT_DURATION_SECONDS, '1');
    await redisClient.del(aKey);
  }
}

export async function resetLoginAttempts(scope: string, identifier: string): Promise<void> {
  await redisClient.del([attemptsKey(scope, identifier), lockoutKey(scope, identifier)]);
}

export function getLoginScope(
  sessionType: 'superadmin' | 'owner-billing' | 'tenant-operational',
  tenantId?: string,
): string {
  if (sessionType === 'superadmin') return 'superadmin';
  if (sessionType === 'owner-billing') return 'owner-billing';
  return `tenant:${tenantId}`;
}
