import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { ListingMode } from '@prisma/client';

const MODE_ALIAS: Record<string, ListingMode | undefined> = {
  stays: ListingMode.SHORT_TERM,
  rentals: ListingMode.LONG_TERM,
  sales: ListingMode.SALE,
  SHORT_TERM: ListingMode.SHORT_TERM,
  LONG_TERM: ListingMode.LONG_TERM,
  SALE: ListingMode.SALE,
};

export async function searchListings(req: Request, res: Response): Promise<void> {
  const { mode, minPrice, maxPrice, city, country, search } = req.query;
  const limit = Number(req.query.limit ?? 20);
  const offset = Number(req.query.offset ?? 0);

  const where: any = { isActive: true };

  if (mode && typeof mode === 'string') {
    const mapped = MODE_ALIAS[mode] ?? MODE_ALIAS[mode.toLowerCase()];
    if (mapped) where.mode = mapped;
  }

  if (city && typeof city === 'string') where.city = { equals: city, mode: 'insensitive' };
  if (country && typeof country === 'string') where.country = { equals: country, mode: 'insensitive' };

  if (search && typeof search === 'string') {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Note: ratePerUnit is stored as string; simple lexical comparisons may suffice for similar digit lengths.
  if ((minPrice && typeof minPrice === 'string') || (maxPrice && typeof maxPrice === 'string')) {
    where.AND = where.AND ?? [];
    if (minPrice && typeof minPrice === 'string') where.AND.push({ ratePerUnit: { gte: minPrice } });
    if (maxPrice && typeof maxPrice === 'string') where.AND.push({ ratePerUnit: { lte: maxPrice } });
  }

  const [total, items] = await Promise.all([
    prisma.listing.count({ where }),
    prisma.listing.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { lastSyncedAt: 'desc' },
      select: {
        id: true,
        onChainId: true,
        title: true,
        description: true,
        city: true,
        country: true,
        latitude: true,
        longitude: true,
        imageUrls: true,
        ratePerUnit: true,
        depositRequired: true,
        mode: true,
        isActive: true,
        lastSyncedAt: true,
        host: { select: { stellarAddress: true, displayName: true, avatarUrl: true } },
      },
    }),
  ]);

  res.json({ total, items });
}

export async function getListingDetails(req: Request, res: Response): Promise<void> {
  const id = req.params.id;

  const listing = await prisma.listing.findFirst({
    where: { OR: [{ id }, { onChainId: id }] },
    include: {
      host: { select: { id: true, stellarAddress: true, displayName: true, avatarUrl: true } },
      reservations: {
        orderBy: { checkIn: 'asc' },
        include: { guest: { select: { stellarAddress: true, displayName: true } }, escrow: true },
      },
      escrows: {
        where: { status: { in: ['LOCKED', 'DISPUTED'] } },
      },
      reviews: { take: 10, orderBy: { createdAt: 'desc' } },
    },
  });

  if (!listing) {
    res.status(404).json({ error: 'listing_not_found' });
    return;
  }

  res.json({ listing });
}
