import { filterAndParseEvents } from '../event.parser';
import type { SorobanEvent, ParsedEvent } from '../event.parser';
import { handleListingCreated, handleListingUpdated } from './listing.handler';
import { handleReservationMade, handleBookingConfirmed } from './reservation.handler';

type EventHandler = (event: ParsedEvent) => Promise<void>;

const HANDLERS: Record<string, EventHandler> = {
  listing_created: handleListingCreated,
  listing_updated: handleListingUpdated,
  // Reservation and booking handlers
  reservation_made: handleReservationMade,
  booking_confirmed: handleBookingConfirmed,
};

export async function processContractEvents(events: SorobanEvent[]): Promise<void> {
  const parsed = filterAndParseEvents(events);

  for (const event of parsed) {
    const handler = HANDLERS[event.topic];
    if (handler) {
      await handler(event);
    } else {
      console.log(`[dispatcher] unhandled topic="${event.topic}" id=${event.id}`);
    }
  }
}
