import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { ReservationStatus, EscrowStatus, LeaseStatus } from '@prisma/client';

export async function getTenantDashboard(req: Request, res: Response): Promise<void> {
  const address = req.query.address;
  if (!address || typeof address !== 'string') {
    res.status(400).json({ error: 'missing_address' });
    return;
  }

  const [reservations, leases, escrows] = await Promise.all([
    prisma.reservation.findMany({
      where: { guest: { stellarAddress: address } },
      include: {
        listing: true,
        escrow: true,
      },
      orderBy: { checkIn: 'asc' },
    }),
    prisma.lease.findMany({
      where: { tenantAddress: address, status: { in: [LeaseStatus.ACTIVE, LeaseStatus.PAUSED] } },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.escrow.findMany({
      where: { depositorAddress: address, status: { in: [EscrowStatus.LOCKED, EscrowStatus.DISPUTED] } },
      include: { listing: true, reservation: true },
    }),
  ]);

  const activeStays = reservations.filter((reservation) =>
    (['CONFIRMED', 'CHECKED_IN'] as string[]).includes(reservation.status),
  );
  const upcomingStays = reservations.filter((reservation) => reservation.status === ReservationStatus.PENDING);
  const completedStays = reservations.filter((reservation) => reservation.status === ReservationStatus.COMPLETED);

  const totalLockedEscrow = escrows.reduce((acc, e) => acc + BigInt(e.amount), 0n);

  res.json({
    address,
    activeStays,
    upcomingStays,
    completedStays,
    paymentStreams: leases,
    lockedEscrows: escrows,
    totalLockedEscrow: totalLockedEscrow.toString(),
    summary: {
      activeStayCount: activeStays.length,
      upcomingStayCount: upcomingStays.length,
      completedStayCount: completedStays.length,
      activeStreams: leases.length,
      lockedEscrowCount: escrows.length,
    },
  });
}
