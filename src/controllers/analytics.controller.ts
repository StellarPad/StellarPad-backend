import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { ListingMode, ReservationStatus } from '@prisma/client';
import { env } from '../config/env';

const MODE_ALIAS: Record<string, ListingMode | undefined> = {
  stays: ListingMode.SHORT_TERM,
  rentals: ListingMode.LONG_TERM,
  sales: ListingMode.SALE,
  SHORT_TERM: ListingMode.SHORT_TERM,
  LONG_TERM: ListingMode.LONG_TERM,
  SALE: ListingMode.SALE,
};

function parseDate(value: unknown): Date | undefined {
  if (!value || typeof value !== 'string') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toBigIntString(value: string | null | undefined): bigint {
  if (!value) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

export async function getSavingsAnalytics(req: Request, res: Response): Promise<void> {
  const feeRate = Math.max(0, Math.min(1, Number(req.query.platformFeePercent ?? '0.15')));
  const modeQuery = req.query.mode;
  const since = parseDate(req.query.since);
  const until = parseDate(req.query.until);

  const where: any = {
    status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN, ReservationStatus.COMPLETED] },
  };

  if (since) {
    where.createdAt = { ...where.createdAt, gte: since };
  }
  if (until) {
    where.createdAt = { ...where.createdAt, lte: until };
  }

  const listingMode = typeof modeQuery === 'string' ? MODE_ALIAS[modeQuery] ?? MODE_ALIAS[modeQuery.toLowerCase()] : undefined;
  if (listingMode) {
    where.listing = { mode: listingMode };
  }

  const reservations = await prisma.reservation.findMany({
    where,
    include: { listing: true },
  });

  const reservationCount = reservations.length;
  const totalAmount = reservations.reduce((acc, reservation) => acc + toBigIntString(reservation.totalAmount), 0n);

  const estimatedPlatformFee = Number(totalAmount) * feeRate;
  const baseFeeStroops = BigInt(Number(process.env['STELLAR_BASE_FEE'] ?? '100'));
  const totalNetworkStroops = baseFeeStroops * BigInt(reservationCount);
  const totalNetworkXLM = Number(totalNetworkStroops) / 1e7;

  const savings = estimatedPlatformFee - totalNetworkXLM;
  const savingsRatio = estimatedPlatformFee > 0 ? savings / estimatedPlatformFee : 0;

  res.json({
    reservationCount,
    totalAmount: totalAmount.toString(),
    estimatedPlatformFee: estimatedPlatformFee.toFixed(8),
    platformFeeRate: feeRate,
    totalNetworkStroops: totalNetworkStroops.toString(),
    totalNetworkXLM,
    estimatedSavings: savings.toFixed(8),
    savingsRatio,
    window: {
      since: since?.toISOString(),
      until: until?.toISOString(),
    },
    mode: listingMode ?? null,
    note: 'Estimated platform fee is computed as totalAmount * platformFeePercent. Network fee is the base ledger fee per transaction.'
  });
}
