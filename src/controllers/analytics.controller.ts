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

export async function getRevenueBreakdown(req: Request, res: Response): Promise<void> {
  const address = req.query.address as string | undefined;
  const since = parseDate(req.query.since);
  const until = parseDate(req.query.until);

  const where: any = { status: ReservationStatus.COMPLETED };
  if (address) where.listing = { host: { stellarAddress: address } };
  if (since || until) {
    where.createdAt = {};
    if (since) where.createdAt.gte = since;
    if (until) where.createdAt.lte = until;
  }

  const reservations = await prisma.reservation.findMany({
    where,
    select: { totalAmount: true, listing: { select: { id: true, title: true, mode: true } } },
  });

  // Group by listing
  const byListing = new Map<string, { id: string; title: string; mode: string; total: bigint; count: number }>();
  for (const r of reservations) {
    const key = r.listing.id;
    const entry = byListing.get(key) ?? { id: r.listing.id, title: r.listing.title, mode: r.listing.mode, total: 0n, count: 0 };
    entry.total += toBigIntString(r.totalAmount);
    entry.count += 1;
    byListing.set(key, entry);
  }

  // Platform split constants (matches README fee model)
  const LANDLORD = 0.70;
  const MANAGER  = 0.20;
  const PLATFORM = 0.08;
  const RESERVE  = 0.02;

  const grandTotal = reservations.reduce((acc, r) => acc + toBigIntString(r.totalAmount), 0n);
  const n = Number(grandTotal);

  res.json({
    grandTotalStroops: grandTotal.toString(),
    split: {
      landlord: Math.floor(n * LANDLORD).toString(),
      manager:  Math.floor(n * MANAGER).toString(),
      platform: Math.floor(n * PLATFORM).toString(),
      reserve:  Math.floor(n * RESERVE).toString(),
    },
    byListing: [...byListing.values()].map((l) => ({ ...l, total: l.total.toString() })),
    window: { since: since?.toISOString(), until: until?.toISOString() },
  });
}

export async function getTopListings(req: Request, res: Response): Promise<void> {
  const limit = Math.min(Number(req.query.limit ?? 10), 50);
  const since = parseDate(req.query.since);

  const where: any = { status: ReservationStatus.COMPLETED };
  if (since) where.createdAt = { gte: since };

  const rows = await prisma.reservation.groupBy({
    by: ['listingId'],
    where,
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: limit,
  });

  const listingIds = rows.map((r) => r.listingId);
  const listings = await prisma.listing.findMany({
    where: { id: { in: listingIds } },
    select: { id: true, title: true, city: true, country: true, mode: true, imageUrls: true },
  });
  const listingMap = new Map(listings.map((l) => [l.id, l]));

  // Fetch revenue per listing
  const revenueRows = await prisma.reservation.findMany({
    where: { ...where, listingId: { in: listingIds } },
    select: { listingId: true, totalAmount: true },
  });
  const revenueByListing = new Map<string, bigint>();
  for (const r of revenueRows) {
    revenueByListing.set(r.listingId, (revenueByListing.get(r.listingId) ?? 0n) + toBigIntString(r.totalAmount));
  }

  res.json({
    items: rows.map((r) => ({
      listing: listingMap.get(r.listingId),
      reservationCount: r._count.id,
      totalRevenueStroops: (revenueByListing.get(r.listingId) ?? 0n).toString(),
    })),
  });
}
