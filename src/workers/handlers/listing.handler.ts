import { prisma } from '../../config/prisma';
import { ListingMode } from '@prisma/client';
import type { ParsedEvent } from '../event.parser';

const MODE_MAP: Record<string, ListingMode> = {
  ShortTerm: ListingMode.SHORT_TERM,
  LongTerm: ListingMode.LONG_TERM,
  Sale: ListingMode.SALE,
};

/**
 * Handles `listing_created` contract events.
 * Upserts a Listing row keyed on the on-chain ID so re-ingestion is idempotent.
 */
export async function handleListingCreated(event: ParsedEvent): Promise<void> {
  const d = event.data;

  const onChainId = String(d['id'] ?? '');
  const mode = MODE_MAP[String(d['mode'] ?? '')] ?? ListingMode.SHORT_TERM;
  const hostAddress = String(d['host'] ?? '');
  const tokenAddress = String(d['token_address'] ?? '');
  const ratePerUnit = String(d['rate_per_unit'] ?? '0');
  const depositRequired = String(d['deposit_required'] ?? '0');

  // Upsert host user record (stellar address is the identity)
  const host = await prisma.user.upsert({
    where: { stellarAddress: hostAddress },
    update: {},
    create: { stellarAddress: hostAddress },
  });

  await prisma.listing.upsert({
    where: { onChainId },
    update: { ratePerUnit, depositRequired, isActive: true, lastSyncedAt: new Date() },
    create: {
      onChainId,
      hostId: host.id,
      mode,
      title: `Listing #${onChainId}`,       // enriched later via metadata API
      description: '',
      country: '',
      city: '',
      address: '',
      latitude: 0,
      longitude: 0,
      tokenAddress,
      ratePerUnit,
      depositRequired,
    },
  });

  console.log(`[listing-handler] upserted listing onChainId=${onChainId}`);
}

/**
 * Handles `listing_updated` contract events.
 */
export async function handleListingUpdated(event: ParsedEvent): Promise<void> {
  const d = event.data;
  const onChainId = String(d['id'] ?? '');

  await prisma.listing.updateMany({
    where: { onChainId },
    data: {
      ratePerUnit: d['rate_per_unit'] !== undefined ? String(d['rate_per_unit']) : undefined,
      isActive: d['is_active'] !== undefined ? Boolean(d['is_active']) : undefined,
      lastSyncedAt: new Date(),
    },
  });

  console.log(`[listing-handler] updated listing onChainId=${onChainId}`);
}
