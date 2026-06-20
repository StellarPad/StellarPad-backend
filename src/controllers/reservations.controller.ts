import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { ReservationStatus } from '@prisma/client';
import { HttpError } from '../utils/HttpError';

export async function createReservation(req: Request, res: Response): Promise<void> {
  const { listingId, guestAddress, checkIn, checkOut, totalAmount } = req.body;

  if (!listingId || !guestAddress || !checkIn || !checkOut || !totalAmount) {
    throw new HttpError(400, 'missing_required_fields');
  }

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new HttpError(404, 'listing_not_found');

  const guest = await prisma.user.upsert({
    where: { stellarAddress: guestAddress },
    update: {},
    create: { stellarAddress: guestAddress },
  });

  // Check for conflicting reservations
  const conflict = await prisma.reservation.findFirst({
    where: {
      listingId,
      status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
      AND: [
        { checkIn: { lt: new Date(checkOut) } },
        { checkOut: { gt: new Date(checkIn) } },
      ],
    },
  });

  if (conflict) throw new HttpError(409, 'reservation_conflict');

  const reservation = await prisma.reservation.create({
    data: {
      listingId,
      guestId: guest.id,
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
      totalAmount: String(totalAmount),
      status: ReservationStatus.PENDING,
    },
  });

  res.status(201).json({ reservation });
}

export async function getReservation(req: Request, res: Response): Promise<void> {
  const id = String(req.params['id'] ?? '');

  const reservation = await prisma.reservation.findFirst({
    where: { OR: [{ id }, { onChainRef: id }] },
    include: {
      listing: { select: { id: true, title: true, city: true, country: true, imageUrls: true } },
      guest: { select: { id: true, stellarAddress: true, displayName: true } },
      escrow: true,
    },
  });

  if (!reservation) throw new HttpError(404, 'reservation_not_found');

  res.json({ reservation });
}

export async function listReservationsForListing(req: Request, res: Response): Promise<void> {
  const listingId = String(req.params['listingId'] ?? '');
  const limit = Number(req.query.limit ?? 20);
  const offset = Number(req.query.offset ?? 0);

  const [total, items] = await Promise.all([
    prisma.reservation.count({ where: { listingId } }),
    prisma.reservation.findMany({
      where: { listingId },
      skip: offset,
      take: limit,
      orderBy: { checkIn: 'asc' },
      include: { guest: { select: { stellarAddress: true, displayName: true } }, escrow: true },
    }),
  ]);

  res.json({ total, items });
}

export async function updateReservationStatus(req: Request, res: Response): Promise<void> {
  const id = String(req.params['id'] ?? '');
  const { status } = req.body;

  const allowed: ReservationStatus[] = [
    ReservationStatus.CONFIRMED,
    ReservationStatus.CHECKED_IN,
    ReservationStatus.COMPLETED,
    ReservationStatus.CANCELLED,
  ];

  if (!allowed.includes(status)) {
    throw new HttpError(400, 'invalid_status');
  }

  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation) throw new HttpError(404, 'reservation_not_found');

  const updated = await prisma.reservation.update({
    where: { id },
    data: { status, lastSyncedAt: new Date() },
  });

  res.json({ reservation: updated });
}

export async function getReservationsForUser(req: Request, res: Response): Promise<void> {
  const address = String(req.params['address'] ?? '');
  const limit = Number(req.query.limit ?? 20);
  const offset = Number(req.query.offset ?? 0);

  const [total, items] = await Promise.all([
    prisma.reservation.count({ where: { guest: { stellarAddress: address } } }),
    prisma.reservation.findMany({
      where: { guest: { stellarAddress: address } },
      skip: offset,
      take: limit,
      orderBy: { checkIn: 'desc' },
      include: {
        listing: { select: { id: true, title: true, city: true, country: true, imageUrls: true } },
        escrow: { select: { id: true, status: true, amount: true } },
      },
    }),
  ]);

  res.json({ total, items });
}
