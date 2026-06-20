import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { HttpError } from '../utils/HttpError';

export async function getListingReviews(req: Request, res: Response): Promise<void> {
  const listingId = String(req.params['listingId'] ?? '');
  const limit = Number(req.query.limit ?? 20);
  const offset = Number(req.query.offset ?? 0);

  const [total, items] = await Promise.all([
    prisma.review.count({ where: { listingId } }),
    prisma.review.findMany({
      where: { listingId },
      skip: offset,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { stellarAddress: true, displayName: true, avatarUrl: true } },
      },
    }),
  ]);

  const avg = total > 0
    ? await prisma.review.aggregate({ where: { listingId }, _avg: { rating: true } })
    : null;

  res.json({ total, averageRating: avg?._avg?.rating ?? null, items });
}

export async function createReview(req: Request, res: Response): Promise<void> {
  const { listingId, authorAddress, targetAddress, rating, comment, txHash } = req.body;

  if (!listingId || !authorAddress || !targetAddress || !rating || !comment) {
    throw new HttpError(400, 'missing_required_fields');
  }

  const parsedRating = Number(rating);
  if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    throw new HttpError(400, 'rating_must_be_1_to_5');
  }

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new HttpError(404, 'listing_not_found');

  const [author, target] = await Promise.all([
    prisma.user.upsert({ where: { stellarAddress: authorAddress }, update: {}, create: { stellarAddress: authorAddress } }),
    prisma.user.upsert({ where: { stellarAddress: targetAddress }, update: {}, create: { stellarAddress: targetAddress } }),
  ]);

  // Check reviewer actually had a completed reservation for this listing
  const completedRes = await prisma.reservation.findFirst({
    where: {
      listingId,
      guestId: author.id,
      status: 'COMPLETED',
    },
  });

  const review = await prisma.review.create({
    data: {
      listingId,
      authorId: author.id,
      targetId: target.id,
      rating: parsedRating,
      comment,
      isVerified: !!completedRes,
      txHash: txHash ?? null,
    },
  });

  res.status(201).json({ review });
}
