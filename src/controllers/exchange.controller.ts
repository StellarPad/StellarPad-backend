import { Request, Response } from 'express';
import { fetchExchangeRates, convertAmount } from '../services/exchange.service';

export async function convertRate(req: Request, res: Response): Promise<void> {
  const { fromAsset, toAsset, amount } = req.query;

  if (!fromAsset || !toAsset || !amount || typeof amount !== 'string') {
    res.status(400).json({ error: 'missing_required_parameters' });
    return;
  }

  const rates = await fetchExchangeRates();
  const converted = convertAmount(amount, String(fromAsset), String(toAsset), rates);

  res.json({ fromAsset: String(fromAsset), toAsset: String(toAsset), amount: String(amount), convertedAmount: converted, rates });
}
