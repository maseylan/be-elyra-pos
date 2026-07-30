import redisClient from '../config/redis';
import crypto from 'crypto';

function resetKey(email: string, type: string): string {
  return `reset:${type}:${email.toLowerCase()}`;
}

function verifyKey(email: string): string {
  return `verify:${email.toLowerCase()}`;
}

export async function generateResetToken(email: string, type: string): Promise<string> {
  const token = crypto.randomUUID();
  await redisClient.setEx(resetKey(email, type), 3600, token);
  return token;
}

export async function verifyResetToken(email: string, token: string, type: string): Promise<boolean> {
  const stored = await redisClient.get(resetKey(email, type));
  if (!stored || stored !== token) return false;
  await redisClient.del(resetKey(email, type));
  return true;
}

export async function generateVerificationToken(email: string): Promise<string> {
  const token = crypto.randomUUID();
  await redisClient.setEx(verifyKey(email), 86400, token);
  return token;
}

export async function verifyEmailToken(email: string, token: string): Promise<boolean> {
  const stored = await redisClient.get(verifyKey(email));
  if (!stored || stored !== token) return false;
  await redisClient.del(verifyKey(email));
  return true;
}
