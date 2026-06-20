import { prisma } from '../../config/prisma';
import { LeaseStatus } from '@prisma/client';
import type { ParsedEvent } from '../event.parser';

export async function handleLeaseStarted(event: ParsedEvent): Promise<void> {
  const d = event.data;
  const onChainLeaseId = String(d['id'] ?? '');
  const listingOnChainId = String(d['listing_id'] ?? '');
  const tenantAddress = String(d['tenant'] ?? '');
  const hostAddress = String(d['host'] ?? '');
  const ratePerSecond = String(d['rate_per_second'] ?? '0');
  const tokenAddress = String(d['token'] ?? '');
  const startedAtUnix = Number(d['started_at'] ?? 0);

  const listing = await prisma.listing.findUnique({ where: { onChainId: listingOnChainId } });
  if (!listing) {
    console.warn(`[lease-handler] listing not found for onChainId=${listingOnChainId}`);
    return;
  }

  await prisma.lease.upsert({
    where: { onChainLeaseId },
    update: { status: LeaseStatus.ACTIVE, lastSyncedAt: new Date() },
    create: {
      listingId: listing.id,
      tenantAddress,
      hostAddress,
      ratePerSecond,
      tokenAddress,
      status: LeaseStatus.ACTIVE,
      startedAt: startedAtUnix ? new Date(startedAtUnix * 1000) : new Date(),
      onChainLeaseId,
    },
  });

  console.log(`[lease-handler] started lease onChainLeaseId=${onChainLeaseId}`);
}

export async function handleLeaseTerminated(event: ParsedEvent): Promise<void> {
  const d = event.data;
  const onChainLeaseId = String(d['id'] ?? '');
  const totalStreamed = String(d['total_streamed'] ?? '0');

  const lease = await prisma.lease.findUnique({ where: { onChainLeaseId } });
  if (!lease) {
    console.warn(`[lease-handler] lease not found for onChainLeaseId=${onChainLeaseId}`);
    return;
  }

  await prisma.lease.update({
    where: { id: lease.id },
    data: {
      status: LeaseStatus.TERMINATED,
      endedAt: new Date(),
      totalStreamed,
      lastSyncedAt: new Date(),
    },
  });

  console.log(`[lease-handler] terminated lease id=${lease.id}`);
}
