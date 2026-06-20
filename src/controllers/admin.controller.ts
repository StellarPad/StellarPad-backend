import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { EscrowStatus, ReservationStatus } from '@prisma/client';
import { HttpError } from '../utils/HttpError';

export async function getPlatformStats(req: Request, res: Response): Promise<void> {
  const [
    totalListings,
    activeListings,
    totalReservations,
    completedReservations,
    openDisputes,
    totalEscrows,
    totalUsers,
    totalReviews,
    escrowVolume,
  ] = await Promise.all([
    prisma.listing.count(),
    prisma.listing.count({ where: { isActive: true } }),
    prisma.reservation.count(),
    prisma.reservation.count({ where: { status: ReservationStatus.COMPLETED } }),
    prisma.escrowClaim.count({ where: { status: 'OPEN' } }),
    prisma.escrow.count(),
    prisma.user.count(),
    prisma.review.count(),
    prisma.escrow.findMany({ select: { amount: true } }),
  ]);

  const totalEscrowVolume = escrowVolume.reduce((acc, e) => {
    try { return acc + BigInt(e.amount); } catch { return acc; }
  }, 0n);

  res.json({
    listings: { total: totalListings, active: activeListings },
    reservations: { total: totalReservations, completed: completedReservations },
    escrows: { total: totalEscrows, openDisputes, volumeStroops: totalEscrowVolume.toString() },
    users: { total: totalUsers },
    reviews: { total: totalReviews },
    ts: new Date().toISOString(),
  });
}

export async function resolveDispute(req: Request, res: Response): Promise<void> {
  const claimId = String(req.params['claimId'] ?? '');
  const { resolution, releaseToLandlord } = req.body;

  if (!resolution) throw new HttpError(400, 'missing_resolution');

  const claim = await prisma.escrowClaim.findUnique({ where: { id: claimId }, include: { escrow: true } });
  if (!claim) throw new HttpError(404, 'claim_not_found');
  if (claim.status !== 'OPEN') throw new HttpError(409, 'claim_already_resolved');

  const newEscrowStatus = releaseToLandlord ? EscrowStatus.RELEASED : EscrowStatus.REFUNDED;

  await prisma.$transaction([
    prisma.escrowClaim.update({
      where: { id: claimId },
      data: { status: 'RESOLVED' },
    }),
    prisma.escrow.update({
      where: { id: claim.escrowId },
      data: { status: newEscrowStatus, releasedAt: new Date() },
    }),
    prisma.reservation.update({
      where: { id: claim.escrow.reservationId },
      data: {
        status: releaseToLandlord ? ReservationStatus.COMPLETED : ReservationStatus.CANCELLED,
        lastSyncedAt: new Date(),
      },
    }),
  ]);

  res.json({ claimId, resolution, escrowStatus: newEscrowStatus });
}

export async function listOpenDisputes(req: Request, res: Response): Promise<void> {
  const limit = Number(req.query.limit ?? 20);
  const offset = Number(req.query.offset ?? 0);

  const [total, items] = await Promise.all([
    prisma.escrowClaim.count({ where: { status: 'OPEN' } }),
    prisma.escrowClaim.findMany({
      where: { status: 'OPEN' },
      skip: offset,
      take: limit,
      orderBy: { initiatedAt: 'asc' },
      include: {
        escrow: {
          include: {
            listing: { select: { id: true, title: true } },
            reservation: { select: { id: true, checkIn: true, checkOut: true } },
          },
        },
      },
    }),
  ]);

  res.json({ total, items });
}
