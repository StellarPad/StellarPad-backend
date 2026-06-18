import { prisma } from '../../config/prisma';
import { ReservationStatus, EscrowStatus } from '@prisma/client';
import type { ParsedEvent } from '../event.parser';

/**
 * Handles `reservation_made` — creates a PENDING reservation record.
 */
export async function handleReservationMade(event: ParsedEvent): Promise<void> {
  const d = event.data;
  const onChainRef = String(d['id'] ?? '');
  const listingOnChainId = String(d['listing_id'] ?? '');
  const guestAddress = String(d['guest'] ?? '');
  const checkIn = new Date(Number(d['check_in']) * 1000);
  const checkOut = new Date(Number(d['check_out']) * 1000);
  const totalAmount = String(d['total_amount'] ?? '0');

  const listing = await prisma.listing.findUnique({ where: { onChainId: listingOnChainId } });
  if (!listing) {
    console.warn(`[reservation-handler] listing not found for onChainId=${listingOnChainId}`);
    return;
  }

  const guest = await prisma.user.upsert({
    where: { stellarAddress: guestAddress },
    update: {},
    create: { stellarAddress: guestAddress },
  });

  await prisma.reservation.upsert({
    where: { onChainRef },
    update: { status: ReservationStatus.PENDING, lastSyncedAt: new Date() },
    create: {
      listingId: listing.id,
      guestId: guest.id,
      status: ReservationStatus.PENDING,
      checkIn,
      checkOut,
      totalAmount,
      onChainRef,
    },
  });

  console.log(`[reservation-handler] upserted reservation onChainRef=${onChainRef}`);
}

/**
 * Handles `booking_confirmed` — confirms reservation and locks escrow.
 */
export async function handleBookingConfirmed(event: ParsedEvent): Promise<void> {
  const d = event.data;
  const onChainRef = String(d['reservation_id'] ?? d['id'] ?? '');
  const txHash = event.txHash;

  const reservation = await prisma.reservation.findUnique({ where: { onChainRef } });
  if (!reservation) {
    console.warn(`[reservation-handler] reservation not found for onChainRef=${onChainRef}`);
    return;
  }

  await prisma.reservation.update({
    where: { id: reservation.id },
    data: { status: ReservationStatus.CONFIRMED, txHash },
  });

  // Lock escrow record for this booking
  const escrowOnChainId = String(d['escrow_id'] ?? '');
  const amount = String(d['amount'] ?? '0');
  const tokenAddress = String(d['token'] ?? '');
  const depositorAddress = String(d['depositor'] ?? d['guest'] ?? '');

  if (escrowOnChainId) {
    await prisma.escrow.upsert({
      where: { onChainEscrowId: escrowOnChainId },
      update: { status: EscrowStatus.LOCKED, txHashLock: txHash },
      create: {
        listingId: reservation.listingId,
        reservationId: reservation.id,
        depositorAddress,
        amount,
        tokenAddress,
        status: EscrowStatus.LOCKED,
        onChainEscrowId: escrowOnChainId,
        txHashLock: txHash,
      },
    });
  }

  console.log(`[reservation-handler] confirmed reservation onChainRef=${onChainRef}`);
}

/**
 * Handles `escrow_disputed` — marks the escrow as DISPUTED so UI can freeze funds.
 */
export async function handleEscrowDisputed(event: ParsedEvent): Promise<void> {
  const d = event.data;
  const escrowOnChainId = String(d['escrow_id'] ?? d['onchain_escrow_id'] ?? '');
  const reservationOnChainRef = String(d['reservation_id'] ?? '');
  const txHash = event.txHash;

  let escrow = null;
  if (escrowOnChainId) {
    escrow = await prisma.escrow.findUnique({ where: { onChainEscrowId: escrowOnChainId } });
  }

  if (!escrow && reservationOnChainRef) {
    const reservation = await prisma.reservation.findUnique({ where: { onChainRef: reservationOnChainRef } });
    if (reservation) {
      escrow = await prisma.escrow.findUnique({ where: { reservationId: reservation.id } });
    }
  }

  if (!escrow) {
    console.warn(`[reservation-handler] escrow not found for escrowOnChainId=${escrowOnChainId} reservationOnChainRef=${reservationOnChainRef}`);
    return;
  }

  await prisma.escrow.update({
    where: { id: escrow.id },
    data: { status: EscrowStatus.DISPUTED, txHashRelease: txHash },
  });

  console.log(`[reservation-handler] flagged escrow id=${escrow.id} onChainEscrowId=${escrowOnChainId} as DISPUTED`);
}
