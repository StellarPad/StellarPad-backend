import { filterAndParseEvents } from '../event.parser';
import type { SorobanEvent, ParsedEvent } from '../event.parser';
import { handleListingCreated, handleListingUpdated } from './listing.handler';
import { handleReservationMade, handleBookingConfirmed, handleEscrowDisputed } from './reservation.handler';
import { tryMarkIngested } from '../idempotency';

type EventHandler = (event: ParsedEvent) => Promise<void>;

const HANDLERS: Record<string, EventHandler> = {
  listing_created: handleListingCreated,
  listing_updated: handleListingUpdated,
  // Reservation and booking handlers
  reservation_made: handleReservationMade,
  booking_confirmed: handleBookingConfirmed,
  escrow_disputed: handleEscrowDisputed,
};

export async function processContractEvents(events: SorobanEvent[]): Promise<void> {
  const parsed = filterAndParseEvents(events);

  for (const event of parsed) {
    // Idempotency guard: mark event+txHash as ingested; if already present, skip.
    try {
      const first = await tryMarkIngested(event.id, event.txHash);
      if (!first) {
        console.log(`[dispatcher] skipping already-ingested event id=${event.id} tx=${event.txHash}`);
        continue;
      }
    } catch (err) {
      console.error('[dispatcher] idempotency check failed:', err);
      // proceed cautiously (do not process) — allow the worker to retry later
      continue;
    }

    const handler = HANDLERS[event.topic];
    if (handler) {
      await handler(event);
    } else {
      console.log(`[dispatcher] unhandled topic="${event.topic}" id=${event.id}`);
    }
  }
}
