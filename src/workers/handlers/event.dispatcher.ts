import { filterAndParseEvents } from '../event.parser';
import type { SorobanEvent, ParsedEvent } from '../event.parser';
import { handleListingCreated, handleListingUpdated } from './listing.handler';
import { handleReservationMade, handleBookingConfirmed, handleEscrowDisputed } from './reservation.handler';
import { handleEscrowLocked, handleEscrowReleased, handleEscrowRefunded } from './escrow.handler';
import { handleLeaseStarted, handleLeaseTerminated } from './lease.handler';
import { handleReviewPosted } from './review.handler';
import { tryMarkIngested } from '../idempotency';

type EventHandler = (event: ParsedEvent) => Promise<void>;

const HANDLERS: Record<string, EventHandler> = {
  // Listing events
  listing_created: handleListingCreated,
  listing_updated: handleListingUpdated,
  // Reservation events
  reservation_made: handleReservationMade,
  booking_confirmed: handleBookingConfirmed,
  reservation_confirmed: handleBookingConfirmed,
  // Escrow events
  escrow_locked: handleEscrowLocked,
  escrow_disputed: handleEscrowDisputed,
  escrow_released: handleEscrowReleased,
  escrow_refunded: handleEscrowRefunded,
  // Lease events
  lease_started: handleLeaseStarted,
  lease_terminated: handleLeaseTerminated,
  // Review events
  review_posted: handleReviewPosted,
};

export async function processContractEvents(events: SorobanEvent[]): Promise<void> {
  const parsed = filterAndParseEvents(events);

  for (const event of parsed) {
    try {
      const first = await tryMarkIngested(event.id, event.txHash);
      if (!first) {
        console.log(`[dispatcher] skipping already-ingested event id=${event.id} tx=${event.txHash}`);
        continue;
      }
    } catch (err) {
      console.error('[dispatcher] idempotency check failed:', err);
      continue;
    }

    const handler = HANDLERS[event.topic];
    if (handler) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[dispatcher] handler error for topic=${event.topic} id=${event.id}:`, err);
      }
    } else {
      console.log(`[dispatcher] unhandled topic="${event.topic}" id=${event.id}`);
    }
  }
}
