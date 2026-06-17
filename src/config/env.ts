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
  STELLAR_NETWORK: (process.env['STELLAR_NETWORK'] ?? 'testnet') as 'testnet' | 'mainnet',
  HORIZON_URL:
    process.env['HORIZON_URL'] ?? 'https://horizon-testnet.stellar.org',
  SOROBAN_RPC_URL:
    process.env['SOROBAN_RPC_URL'] ?? 'https://soroban-testnet.stellar.org',
  CONTRACT_ID: process.env['CONTRACT_ID'] ?? '',
};
