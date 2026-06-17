import { filterAndParseEvents } from '../event.parser';
import type { SorobanEvent } from '../event.parser';

export async function processContractEvents(events: SorobanEvent[]): Promise<void> {
  const parsed = filterAndParseEvents(events);

  for (const event of parsed) {
    console.log(`[dispatcher] topic="${event.topic}" ledger=${event.ledger} id=${event.id}`);
    // Domain handlers wired in STEP 9+
  }
}
