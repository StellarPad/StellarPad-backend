import 'dotenv/config';

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const env = {
  PORT: parseInt(process.env['PORT'] ?? '3000', 10),
  DATABASE_URL: required('DATABASE_URL'),
  NODE_ENV: process.env['NODE_ENV'] ?? 'development',
};
