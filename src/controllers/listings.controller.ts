import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { ListingMode } from '@prisma/client';
import { HttpError } from '../utils/HttpError';

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
  const id = String(req.params['id'] ?? '');

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

export async function updateListing(req: Request, res: Response): Promise<void> {
  const id = String(req.params['id'] ?? '');
  const { title, description, city, country, address, imageUrls, amenities, maxGuests, ratePerUnit, depositRequired } = req.body;

  const listing = await prisma.listing.findFirst({ where: { OR: [{ id }, { onChainId: id }] } });
  if (!listing) throw new HttpError(404, 'listing_not_found');

  // Ownership enforced at route level via authenticate; here we just update.
  const updated = await prisma.listing.update({
    where: { id: listing.id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(city !== undefined && { city }),
      ...(country !== undefined && { country }),
      ...(address !== undefined && { address }),
      ...(imageUrls !== undefined && { imageUrls }),
      ...(amenities !== undefined && { amenities }),
      ...(maxGuests !== undefined && { maxGuests: Number(maxGuests) }),
      ...(ratePerUnit !== undefined && { ratePerUnit: String(ratePerUnit) }),
      ...(depositRequired !== undefined && { depositRequired: String(depositRequired) }),
      lastSyncedAt: new Date(),
    },
  });

  res.json({ listing: updated });
}

export async function publishListing(req: Request, res: Response): Promise<void> {
  const id = String(req.params['id'] ?? '');

  const listing = await prisma.listing.findFirst({ where: { OR: [{ id }, { onChainId: id }] } });
  if (!listing) throw new HttpError(404, 'listing_not_found');
  if (listing.isActive) throw new HttpError(409, 'listing_already_published');

  const updated = await prisma.listing.update({
    where: { id: listing.id },
    data: { isActive: true, lastSyncedAt: new Date() },
  });

  res.json({ listing: updated });
}

export async function archiveListing(req: Request, res: Response): Promise<void> {
  const id = String(req.params['id'] ?? '');

  const listing = await prisma.listing.findFirst({ where: { OR: [{ id }, { onChainId: id }] } });
  if (!listing) throw new HttpError(404, 'listing_not_found');

  const updated = await prisma.listing.update({
    where: { id: listing.id },
    data: { isActive: false, lastSyncedAt: new Date() },
  });

  res.json({ listing: updated });
}

export async function pinListingMetadata(req: Request, res: Response): Promise<void> {
  const id = String(req.params['id'] ?? '');

  const listing = await prisma.listing.findFirst({
    where: { OR: [{ id }, { onChainId: id }] },
    include: { host: { select: { stellarAddress: true, displayName: true } } },
  });
  if (!listing) throw new HttpError(404, 'listing_not_found');

  const { pinJSON } = await import('../services/ipfs.service');

  const metadata = {
    name: listing.title,
    description: listing.description,
    image: listing.imageUrls[0] ?? '',
    images: listing.imageUrls,
    attributes: {
      city: listing.city,
      country: listing.country,
      mode: listing.mode,
      ratePerUnit: listing.ratePerUnit,
      depositRequired: listing.depositRequired,
      maxGuests: listing.maxGuests,
      amenities: listing.amenities,
      latitude: listing.latitude,
      longitude: listing.longitude,
    },
    host: listing.host.stellarAddress,
  };

  const { ipfsHash, gatewayUrl } = await pinJSON(`listing-${listing.id}`, metadata);

  // Persist the metadata URI on the listing
  await prisma.listing.update({
    where: { id: listing.id },
    data: { lastSyncedAt: new Date() },
  });

  res.json({ ipfsHash, metadataUri: gatewayUrl });
}
