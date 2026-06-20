import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { EscrowStatus } from '@prisma/client';
import { HttpError } from '../utils/HttpError';

export async function getEscrow(req: Request, res: Response): Promise<void> {
  const id = String(req.params['id'] ?? '');

  const escrow = await prisma.escrow.findFirst({
    where: { OR: [{ id }, { onChainEscrowId: id }] },
    include: {
      listing: { select: { id: true, title: true, city: true } },
      reservation: { select: { id: true, checkIn: true, checkOut: true, status: true } },
      claims: true,
    },
  });

  if (!escrow) throw new HttpError(404, 'escrow_not_found');
  res.json({ escrow });
}

export async function getEscrowForReservation(req: Request, res: Response): Promise<void> {
  const reservationId = String(req.params['reservationId'] ?? '');

  const reservation = await prisma.reservation.findFirst({
    where: { OR: [{ id: reservationId }, { onChainRef: reservationId }] },
    include: { escrow: { include: { claims: true } } },
  });

  if (!reservation) throw new HttpError(404, 'reservation_not_found');
  if (!reservation.escrow) throw new HttpError(404, 'escrow_not_found');

  res.json({ escrow: reservation.escrow });
}

export async function releaseEscrow(req: Request, res: Response): Promise<void> {
  const id = String(req.params['id'] ?? '');
  const { txHash } = req.body;

  const escrow = await prisma.escrow.findFirst({
    where: { OR: [{ id }, { onChainEscrowId: id }] },
  });

  if (!escrow) throw new HttpError(404, 'escrow_not_found');
  if (escrow.status !== EscrowStatus.LOCKED) {
    throw new HttpError(409, `escrow_not_releasable: current status is ${escrow.status}`);
  }

  const updated = await prisma.escrow.update({
    where: { id: escrow.id },
    data: {
      status: EscrowStatus.RELEASED,
      releasedAt: new Date(),
      txHashRelease: txHash ?? null,
    },
  });

  // Mark reservation as completed
  await prisma.reservation.update({
    where: { id: escrow.reservationId },
    data: { status: 'COMPLETED', lastSyncedAt: new Date() },
  });

  res.json({ escrow: updated });
}

export async function refundEscrow(req: Request, res: Response): Promise<void> {
  const id = String(req.params['id'] ?? '');
  const { txHash } = req.body;

  const escrow = await prisma.escrow.findFirst({
    where: { OR: [{ id }, { onChainEscrowId: id }] },
  });

  if (!escrow) throw new HttpError(404, 'escrow_not_found');
  if (!([EscrowStatus.LOCKED, EscrowStatus.DISPUTED] as string[]).includes(escrow.status)) {
    throw new HttpError(409, `escrow_not_refundable: current status is ${escrow.status}`);
  }

  const updated = await prisma.escrow.update({
    where: { id: escrow.id },
    data: {
      status: EscrowStatus.REFUNDED,
      releasedAt: new Date(),
      txHashRelease: txHash ?? null,
    },
  });

  await prisma.reservation.update({
    where: { id: escrow.reservationId },
    data: { status: 'CANCELLED', lastSyncedAt: new Date() },
  });

  res.json({ escrow: updated });
}

export async function createEscrowDispute(req: Request, res: Response): Promise<void> {
  const id = String(req.params['id'] ?? '');
  const { claimantAddress, description, metadata } = req.body;

  if (!claimantAddress || !description) {
    throw new HttpError(400, 'missing_required_fields');
  }

  const escrow = await prisma.escrow.findFirst({
    where: { OR: [{ id }, { onChainEscrowId: id }] },
  });

  if (!escrow) throw new HttpError(404, 'escrow_not_found');
  if (escrow.status !== EscrowStatus.LOCKED) {
    throw new HttpError(409, 'escrow_not_disputable');
  }

  const [claim] = await prisma.$transaction([
    prisma.escrowClaim.create({
      data: { escrowId: escrow.id, claimantAddress, description, metadata: metadata ?? undefined, status: 'OPEN' },
    }),
    prisma.escrow.update({
      where: { id: escrow.id },
      data: { status: EscrowStatus.DISPUTED },
    }),
  ]);

  res.status(201).json({ claim });
}
