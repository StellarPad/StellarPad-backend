import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { ReservationStatus, EscrowStatus } from '@prisma/client';
import { HttpError } from '../utils/HttpError';

export async function upsertUser(req: Request, res: Response): Promise<void> {
  const { stellarAddress, displayName, avatarUrl, emailHash } = req.body;
  if (!stellarAddress) throw new HttpError(400, 'missing_stellar_address');

  const user = await prisma.user.upsert({
    where: { stellarAddress },
    update: {
      ...(displayName !== undefined && { displayName }),
      ...(avatarUrl !== undefined && { avatarUrl }),
      ...(emailHash !== undefined && { emailHash }),
    },
    create: { stellarAddress, displayName: displayName ?? null, avatarUrl: avatarUrl ?? null, emailHash: emailHash ?? null },
    select: { id: true, stellarAddress: true, displayName: true, avatarUrl: true, isVerified: true, createdAt: true },
  });

  res.json({ user });
}

export async function getPublicProfile(req: Request, res: Response): Promise<void> {
  const address = String(req.params['address'] ?? '');

  const user = await prisma.user.findUnique({
    where: { stellarAddress: address },
    select: { id: true, stellarAddress: true, displayName: true, avatarUrl: true, isVerified: true, createdAt: true },
  });
  if (!user) throw new HttpError(404, 'user_not_found');

  const [listings, reviews, totalReservations, completedReservations, avgRating] = await Promise.all([
    prisma.listing.findMany({
      where: { host: { stellarAddress: address }, isActive: true },
      select: { id: true, title: true, city: true, country: true, imageUrls: true, ratePerUnit: true, mode: true },
      take: 10,
      orderBy: { lastSyncedAt: 'desc' },
    }),
    prisma.review.findMany({
      where: { target: { stellarAddress: address } },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { stellarAddress: true, displayName: true } } },
    }),
    prisma.reservation.count({ where: { guest: { stellarAddress: address } } }),
    prisma.reservation.count({ where: { guest: { stellarAddress: address }, status: ReservationStatus.COMPLETED } }),
    prisma.review.aggregate({ where: { target: { stellarAddress: address } }, _avg: { rating: true }, _count: true }),
  ]);

  res.json({
    user,
    listings,
    reviews: { total: avgRating._count, averageRating: avgRating._avg.rating, recent: reviews },
    stats: { totalReservations, completedReservations, listingCount: listings.length },
  });
}

export async function getUserReputation(req: Request, res: Response): Promise<void> {
  const address = String(req.params['address'] ?? '');

  const user = await prisma.user.findUnique({ where: { stellarAddress: address } });
  if (!user) throw new HttpError(404, 'user_not_found');

  const [successCount, disputeCount, totalReservations] = await Promise.all([
    prisma.reservation.count({
      where: {
        OR: [{ guest: { stellarAddress: address } }, { listing: { host: { stellarAddress: address } } }],
        status: { in: [ReservationStatus.CHECKED_IN, ReservationStatus.COMPLETED] },
      },
    }),
    prisma.escrow.count({
      where: {
        OR: [{ reservation: { guest: { stellarAddress: address } } }, { listing: { host: { stellarAddress: address } } }],
        status: EscrowStatus.DISPUTED,
      },
    }),
    prisma.reservation.count({
      where: { OR: [{ guest: { stellarAddress: address } }, { listing: { host: { stellarAddress: address } } }] },
    }),
  ]);

  const score = totalReservations > 0 ? Math.max(0, (successCount - disputeCount) / totalReservations) : 0;

  res.json({
    address,
    successfulCheckouts: successCount,
    disputes: disputeCount,
    totalReservations,
    reputationScore: Number(score.toFixed(3)),
    successRate: totalReservations > 0 ? Number((successCount / totalReservations).toFixed(3)) : 0,
    disputeRate: totalReservations > 0 ? Number((disputeCount / totalReservations).toFixed(3)) : 0,
  });
}
