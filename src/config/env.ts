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
  STABLECOIN_USDC_ISSUER: process.env['STABLECOIN_USDC_ISSUER'] ?? '',
  STABLECOIN_EURC_ISSUER: process.env['STABLECOIN_EURC_ISSUER'] ?? '',
  FIAT_USD_ISSUER: process.env['FIAT_USD_ISSUER'] ?? '',
  FIAT_EUR_ISSUER: process.env['FIAT_EUR_ISSUER'] ?? '',
  JWT_SECRET: process.env['JWT_SECRET'] ?? 'change_me_in_production',
  JWT_EXPIRES_IN: process.env['JWT_EXPIRES_IN'] ?? '1h',
};
