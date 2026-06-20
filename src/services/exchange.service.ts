import fetch from 'node-fetch';
import { env } from '../config/env';

export interface ExchangeRateResult {
  asset: string;
  rateToUSD: number;
  rateToEUR: number;
}

const STABLECOIN_ASSETS = {
  USDC: env.STABLECOIN_USDC_ISSUER,
  EURC: env.STABLECOIN_EURC_ISSUER,
};

export async function fetchExchangeRates(): Promise<Record<string, ExchangeRateResult>> {
  const response = await fetch('https://api.exchangerate.host/latest?base=USD');
  if (!response.ok) throw new Error('failed to fetch fiat exchange rates');
  const body = (await response.json()) as { rates?: Record<string, number> };
  const usdToEur = body.rates?.EUR ?? 1;

  return {
    USD: { asset: 'USD', rateToUSD: 1, rateToEUR: usdToEur },
    EUR: { asset: 'EUR', rateToUSD: 1 / usdToEur, rateToEUR: 1 },
    USDC: { asset: 'USDC', rateToUSD: 1, rateToEUR: usdToEur },
    EURC: { asset: 'EURC', rateToUSD: 1 / usdToEur, rateToEUR: 1 },
  };
}

export function convertAmount(amount: string, fromAsset: string, toAsset: string, rates: Record<string, ExchangeRateResult>): string {
  const from = rates[fromAsset.toUpperCase()];
  const to = rates[toAsset.toUpperCase()];
  if (!from || !to) throw new Error('unsupported asset');

  const numericAmount = Number(amount);
  if (Number.isNaN(numericAmount)) throw new Error('invalid amount');

  const usdValue = numericAmount * from.rateToUSD;
  const targetValue = usdValue * (1 / to.rateToUSD);
  return targetValue.toFixed(6);
}
