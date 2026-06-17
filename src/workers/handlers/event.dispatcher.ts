import type { rpc } from '@stellar/stellar-sdk';

type SorobanEvent = rpc.Api.EventResponse;

/**
 * Routes each ingested contract event to the appropriate domain handler.
 * Handlers are registered in subsequent steps.
 */
export async function processContractEvents(events: SorobanEvent[]): Promise<void> {
  for (const event of events) {
    const topic = event.topic[0]?.value?.toString() ?? '';
    console.log(`[dispatcher] event topic="${topic}" id=${event.id}`);
    // Handlers wired in STEP 8+
  }
}
