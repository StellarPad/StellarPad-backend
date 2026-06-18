import { Request, Response } from 'express';
import { buildUnsignedBookingXDR } from '../services/xdr.builder';

export async function createUnsignedBookingTx(req: Request, res: Response): Promise<void> {
  const { listingOnChainId, tenantPublicKey, checkInUnix, checkOutUnix, amount, tokenAddress } = req.body;

  if (!listingOnChainId || !tenantPublicKey || !checkInUnix || !checkOutUnix || !amount) {
    res.status(400).json({ error: 'missing required parameters' });
    return;
  }

  const xdr = await buildUnsignedBookingXDR({ listingOnChainId, tenantPublicKey, checkInUnix, checkOutUnix, amount, tokenAddress });
  res.json({ xdr });
}
