export function sanitizeError(err: any): string {
  if (process.env.NODE_ENV === 'production') {
    return 'Kesalahan server internal';
  }
  return err?.message || 'Kesalahan server internal';
}
