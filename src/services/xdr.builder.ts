import { TransactionBuilder, Account, Operation, Networks } from '@stellar/stellar-sdk';
import { horizon } from './stellar.service';
import { env } from '../config/env';

export interface BookingParams {
  listingOnChainId: string;
  tenantPublicKey: string;
  checkInUnix: number; // seconds
  checkOutUnix: number; // seconds
  amount: string; // i128 as string
  tokenAddress?: string;
}

export async function buildUnsignedBookingXDR(params: BookingParams): Promise<string> {
  // Load tenant account to get current sequence number
  const accountResp = await horizon.loadAccount(params.tenantPublicKey);
  const source = new Account(params.tenantPublicKey, accountResp.sequence);

  const fee = Number(process.env['STELLAR_BASE_FEE'] ?? 100);

  const meta = JSON.stringify({
    listingOnChainId: params.listingOnChainId,
    checkIn: params.checkInUnix,
    checkOut: params.checkOutUnix,
    amount: params.amount,
    token: params.tokenAddress ?? null,
  });

  const tx = new TransactionBuilder(source, {
    fee: String(fee),
    networkPassphrase: env.STELLAR_NETWORK,
  })
    .addOperation(Operation.manageData({ name: `reserve:${params.listingOnChainId}`, value: meta }))
    .setTimeout(180)
    .build();

  return tx.toXDR('base64');
}
