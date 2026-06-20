import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { ListingMode } from '@prisma/client';
import { horizon } from '../services/stellar.service';
import { TransactionBuilder, Account, Operation, Networks } from '@stellar/stellar-sdk';
import { env } from '../config/env';
import { HttpError } from '../utils/HttpError';

const MODE_ALIAS: Record<string, ListingMode> = {
  SHORT_TERM: ListingMode.SHORT_TERM,
  LONG_TERM: ListingMode.LONG_TERM,
  SALE: ListingMode.SALE,
  stays: ListingMode.SHORT_TERM,
  rentals: ListingMode.LONG_TERM,
  sales: ListingMode.SALE,
};

export async function createListingDraft(req: Request, res: Response): Promise<void> {
  const { draftId, hostAddress, mode, title, description, country, city, address, latitude, longitude, imageUrls, amenities, maxGuests, tokenAddress, ratePerUnit, depositRequired } = req.body;

  if (!draftId || !hostAddress || !mode || !title || !description) {
    throw new HttpError(400, 'missing_required_fields');
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
      hostId: host.id, mode: listingMode, title, description,
      country: country ?? '', city: city ?? '', address: address ?? '',
      latitude: latitude ?? 0, longitude: longitude ?? 0,
      imageUrls: imageUrls ?? [], amenities: amenities ?? [],
      maxGuests: Number(maxGuests ?? 1), tokenAddress: tokenAddress ?? '',
      ratePerUnit: ratePerUnit ?? '0', depositRequired: depositRequired ?? '0',
      lastSyncedAt: new Date(), isActive: false,
    },
    create: {
      draftId, onChainId: `draft-${draftId}`, hostId: host.id, mode: listingMode,
      title, description, country: country ?? '', city: city ?? '', address: address ?? '',
      latitude: latitude ?? 0, longitude: longitude ?? 0,
      imageUrls: imageUrls ?? [], amenities: amenities ?? [],
      maxGuests: Number(maxGuests ?? 1), tokenAddress: tokenAddress ?? '',
      ratePerUnit: ratePerUnit ?? '0', depositRequired: depositRequired ?? '0', isActive: false,
    },
  });

  res.status(201).json({ listing });
}

export async function getDraft(req: Request, res: Response): Promise<void> {
  const draftId = String(req.params['draftId'] ?? '');

  const listing = await prisma.listing.findUnique({
    where: { draftId },
    include: { host: { select: { stellarAddress: true, displayName: true } } },
  });

  if (!listing) throw new HttpError(404, 'draft_not_found');
  res.json({ listing });
}

export async function buildPublishXDR(req: Request, res: Response): Promise<void> {
  const { draftId, hostPublicKey, priceUsdc, availabilityDays } = req.body;

  if (!draftId || !hostPublicKey || !priceUsdc) {
    throw new HttpError(400, 'missing_required_fields');
  }

  const listing = await prisma.listing.findUnique({ where: { draftId } });
  if (!listing) throw new HttpError(404, 'draft_not_found');

  const accountResp = await horizon.loadAccount(hostPublicKey);
  const source = new Account(hostPublicKey, accountResp.sequence);

  const meta = JSON.stringify({
    action: 'publish_listing',
    listingId: listing.onChainId,
    priceUsdc: String(priceUsdc),
    availabilityDays: Number(availabilityDays ?? 365),
  });

  const networkPassphrase = env.STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

  const tx = new TransactionBuilder(source, {
    fee: String(Number(process.env['STELLAR_BASE_FEE'] ?? 100)),
    networkPassphrase,
  })
    .addOperation(Operation.manageData({ name: `publish:${listing.onChainId}`, value: meta }))
    .setTimeout(180)
    .build();

  res.json({ xdr: tx.toXDR(), listingId: listing.onChainId, draftId });
}
