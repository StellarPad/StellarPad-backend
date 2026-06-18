import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { ReservationStatus, EscrowStatus } from '@prisma/client';

export async function getUserReputation(req: Request, res: Response): Promise<void> {
  const address = req.params.address;
  if (!address) {
    res.status(400).json({ error: 'missing_address' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { stellarAddress: address } });
  if (!user) {
    res.status(404).json({ error: 'user_not_found' });
    return;
  }

  const [successCount, disputeCount, totalReservations] = await Promise.all([
    prisma.reservation.count({
      where: {
        OR: [
          { guest: { stellarAddress: address } },
          { listing: { host: { stellarAddress: address } } },
        ],
        status: { in: [ReservationStatus.CHECKED_IN, ReservationStatus.COMPLETED] },
      },
    }),
    prisma.escrow.count({
      where: {
        OR: [
          { reservation: { guest: { stellarAddress: address } } },
          { listing: { host: { stellarAddress: address } } },
        ],
        status: EscrowStatus.DISPUTED,
      },
    }),
    prisma.reservation.count({
      where: {
        OR: [
          { guest: { stellarAddress: address } },
          { listing: { host: { stellarAddress: address } } },
        ],
      },
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
