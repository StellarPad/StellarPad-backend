import { prisma } from '../../config/prisma';
import { EscrowStatus, ReservationStatus } from '@prisma/client';
import type { ParsedEvent } from '../event.parser';

export async function handleEscrowLocked(event: ParsedEvent): Promise<void> {
  const d = event.data;
  const onChainEscrowId = String(d['id'] ?? '');
  const reservationOnChainRef = String(d['reservation_id'] ?? '');
  const depositorAddress = String(d['depositor'] ?? '');
  const amount = String(d['amount'] ?? '0');
  const tokenAddress = String(d['token'] ?? '');
  const txHash = event.txHash;

  const reservation = await prisma.reservation.findUnique({ where: { onChainRef: reservationOnChainRef } });
  if (!reservation) {
    console.warn(`[escrow-handler] reservation not found for onChainRef=${reservationOnChainRef}`);
    return;
  }

  await prisma.escrow.upsert({
    where: { onChainEscrowId },
    update: { status: EscrowStatus.LOCKED, txHashLock: txHash },
    create: {
      listingId: reservation.listingId,
      reservationId: reservation.id,
      depositorAddress,
      amount,
      tokenAddress,
      status: EscrowStatus.LOCKED,
      onChainEscrowId,
      txHashLock: txHash,
    },
  });

  console.log(`[escrow-handler] locked escrow onChainEscrowId=${onChainEscrowId}`);
}

export async function handleEscrowReleased(event: ParsedEvent): Promise<void> {
  const d = event.data;
  const onChainEscrowId = String(d['id'] ?? d['escrow_id'] ?? '');
  const txHash = event.txHash;

  const escrow = await prisma.escrow.findUnique({ where: { onChainEscrowId } });
  if (!escrow) {
    console.warn(`[escrow-handler] escrow not found for onChainEscrowId=${onChainEscrowId}`);
    return;
  }

  await prisma.escrow.update({
    where: { id: escrow.id },
    data: { status: EscrowStatus.RELEASED, releasedAt: new Date(), txHashRelease: txHash },
  });

  await prisma.reservation.update({
    where: { id: escrow.reservationId },
    data: { status: ReservationStatus.COMPLETED, lastSyncedAt: new Date() },
  });

  console.log(`[escrow-handler] released escrow id=${escrow.id}`);
}

export async function handleEscrowRefunded(event: ParsedEvent): Promise<void> {
  const d = event.data;
  const onChainEscrowId = String(d['id'] ?? d['escrow_id'] ?? '');
  const txHash = event.txHash;

  const escrow = await prisma.escrow.findUnique({ where: { onChainEscrowId } });
  if (!escrow) {
    console.warn(`[escrow-handler] escrow not found for onChainEscrowId=${onChainEscrowId}`);
    return;
  }

  await prisma.escrow.update({
    where: { id: escrow.id },
    data: { status: EscrowStatus.REFUNDED, releasedAt: new Date(), txHashRelease: txHash },
  });

  await prisma.reservation.update({
    where: { id: escrow.reservationId },
    data: { status: ReservationStatus.CANCELLED, lastSyncedAt: new Date() },
  });

  console.log(`[escrow-handler] refunded escrow id=${escrow.id}`);
}
