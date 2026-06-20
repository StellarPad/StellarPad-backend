import { prisma } from '../../config/prisma';
import type { ParsedEvent } from '../event.parser';

export async function handleReviewPosted(event: ParsedEvent): Promise<void> {
  const d = event.data;
  const listingOnChainId = String(d['listing_id'] ?? '');
  const authorAddress = String(d['author'] ?? '');
  const targetAddress = String(d['target'] ?? '');
  const rating = Number(d['rating'] ?? 0);
  const comment = String(d['comment'] ?? '');
  const txHash = event.txHash;

  if (!listingOnChainId || !authorAddress || !targetAddress || rating < 1 || rating > 5) {
    console.warn(`[review-handler] invalid review data in event id=${event.id}`);
    return;
  }

  const listing = await prisma.listing.findUnique({ where: { onChainId: listingOnChainId } });
  if (!listing) {
    console.warn(`[review-handler] listing not found for onChainId=${listingOnChainId}`);
    return;
  }

  const [author, target] = await Promise.all([
    prisma.user.upsert({ where: { stellarAddress: authorAddress }, update: {}, create: { stellarAddress: authorAddress } }),
    prisma.user.upsert({ where: { stellarAddress: targetAddress }, update: {}, create: { stellarAddress: targetAddress } }),
  ]);

  // Idempotent by txHash
  const existing = txHash ? await prisma.review.findFirst({ where: { txHash } }) : null;
  if (existing) {
    console.log(`[review-handler] review already ingested for txHash=${txHash}`);
    return;
  }

  const completedRes = await prisma.reservation.findFirst({
    where: { listingId: listing.id, guestId: author.id, status: 'COMPLETED' },
  });

  await prisma.review.create({
    data: {
      listingId: listing.id,
      authorId: author.id,
      targetId: target.id,
      rating,
      comment,
      isVerified: !!completedRes,
      txHash: txHash || null,
    },
  });

  console.log(`[review-handler] ingested review for listing=${listingOnChainId} author=${authorAddress}`);
}
