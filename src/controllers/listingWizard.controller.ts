import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { ListingMode } from '@prisma/client';

const MODE_ALIAS: Record<string, ListingMode> = {
  SHORT_TERM: ListingMode.SHORT_TERM,
  LONG_TERM: ListingMode.LONG_TERM,
  SALE: ListingMode.SALE,
  stays: ListingMode.SHORT_TERM,
  rentals: ListingMode.LONG_TERM,
  sales: ListingMode.SALE,
};

export async function createListingDraft(req: Request, res: Response): Promise<void> {
  const {
    draftId,
    hostAddress,
    mode,
    title,
    description,
    country,
    city,
    address,
    latitude,
    longitude,
    imageUrls,
    amenities,
    maxGuests,
    tokenAddress,
    ratePerUnit,
    depositRequired,
  } = req.body;

  if (!draftId || !hostAddress || !mode || !title || !description) {
    res.status(400).json({ error: 'missing_required_fields' });
    return;
  }

  const listingMode = MODE_ALIAS[mode] ?? ListingMode.SHORT_TERM;

  const host = await prisma.user.upsert({
    where: { stellarAddress: hostAddress },
    update: {},
    create: { stellarAddress: hostAddress },
  });

  const listing = await prisma.listing.upsert({
    where: { draftId },
    update: {
      hostId: host.id,
      mode: listingMode,
      title,
      description,
      country: country ?? '',
      city: city ?? '',
      address: address ?? '',
      latitude: latitude ?? 0,
      longitude: longitude ?? 0,
      imageUrls: imageUrls ?? [],
      amenities: amenities ?? [],
      maxGuests: Number(maxGuests ?? 1),
      tokenAddress: tokenAddress ?? '',
      ratePerUnit: ratePerUnit ?? '0',
      depositRequired: depositRequired ?? '0',
      lastSyncedAt: new Date(),
      isActive: false,
    },
    create: {
      draftId,
      onChainId: `draft-${draftId}`,
      hostId: host.id,
      mode: listingMode,
      title,
      description,
      country: country ?? '',
      city: city ?? '',
      address: address ?? '',
      latitude: latitude ?? 0,
      longitude: longitude ?? 0,
      imageUrls: imageUrls ?? [],
      amenities: amenities ?? [],
      maxGuests: Number(maxGuests ?? 1),
      tokenAddress: tokenAddress ?? '',
      ratePerUnit: ratePerUnit ?? '0',
      depositRequired: depositRequired ?? '0',
      isActive: false,
    },
  });

  res.status(201).json({ listing });
}
