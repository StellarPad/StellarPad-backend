import { filterAndParseEvents } from '../event.parser';
import type { SorobanEvent, ParsedEvent } from '../event.parser';
import { handleListingCreated, handleListingUpdated } from './listing.handler';

type EventHandler = (event: ParsedEvent) => Promise<void>;

const HANDLERS: Record<string, EventHandler> = {
  listing_created: handleListingCreated,
  listing_updated: handleListingUpdated,
  // Additional handlers registered in STEP 10+
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
