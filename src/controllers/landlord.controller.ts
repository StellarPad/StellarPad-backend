import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { EscrowStatus, LeaseStatus, ReservationStatus } from '@prisma/client';

export async function getLandlordDashboard(req: Request, res: Response): Promise<void> {
  const address = req.query.address;
  if (!address || typeof address !== 'string') {
    res.status(400).json({ error: 'missing_address' });
    return;
  }

  const [listings, escrows, leases, reservations] = await Promise.all([
    prisma.listing.findMany({
      where: { host: { stellarAddress: address } },
      include: { reservations: true, escrows: true },
    }),
    prisma.escrow.findMany({
      where: { listing: { host: { stellarAddress: address } }, status: { in: [EscrowStatus.LOCKED, EscrowStatus.DISPUTED] } },
      include: { reservation: true, listing: true },
    }),
    prisma.lease.findMany({
      where: { hostAddress: address, status: { in: [LeaseStatus.ACTIVE, LeaseStatus.PAUSED] } },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.reservation.findMany({
      where: { listing: { host: { stellarAddress: address } } },
      include: { guest: true, listing: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const totalLockedEscrow = escrows.reduce((acc, e) => acc + BigInt(e.amount), 0n);
  const totalPotentialRevenue = listings.reduce((acc, listing) => {
    const listingTotal = listing.reservations.reduce((sum, reservation) => sum + BigInt(reservation.totalAmount), 0n);
    return acc + listingTotal;
  }, 0n);

  const activeEscrowCount = escrows.filter((escrow) => escrow.status === EscrowStatus.LOCKED).length;
  const disputedEscrowCount = escrows.filter((escrow) => escrow.status === EscrowStatus.DISPUTED).length;
  const totalListingCount = listings.length;
  const totalReservationCount = reservations.length;

  res.json({
    address,
    totalListingCount,
    totalReservationCount,
    totalLockedEscrow: totalLockedEscrow.toString(),
    totalPotentialRevenue: totalPotentialRevenue.toString(),
    activeEscrowCount,
    disputedEscrowCount,
    activePaymentStreams: leases,
    escrows,
    listings,
    recentReservations: reservations.slice(0, 25),
  });
}
