import { scValToNative, xdr } from '@stellar/stellar-sdk';
import { env } from '../config/env';
import type { rpc } from '@stellar/stellar-sdk';

export type SorobanEvent = rpc.Api.EventResponse;

export interface ParsedEvent {
  id: string;
  ledger: number;
  topic: string;
  data: Record<string, unknown>;
  contractId: string | undefined;
  txHash: string;
}

/**
 * Filters raw Soroban events to only those emitted by our contract
 * and decodes their XDR payload into plain JS objects.
 */
export function filterAndParseEvents(events: SorobanEvent[]): ParsedEvent[] {
  return events
    .filter((e) => !env.CONTRACT_ID || e.contractId?.toString() === env.CONTRACT_ID)
    .flatMap((e) => {
      try {
        return [decodeEvent(e)];
      } catch (err) {
        console.warn(`[parser] failed to decode event ${e.id}:`, err);
        return [];
      }
    });
}

function decodeEvent(event: SorobanEvent): ParsedEvent {
  const topic = decodeScVal(event.topic[0]);
  const data = decodeScVal(event.value);

  return {
    id: event.id,
    ledger: event.ledger,
    topic: String(topic),
    data: typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : { raw: data },
    contractId: event.contractId?.toString(),
    txHash: event.txHash,
  };
}

function decodeScVal(val: unknown): unknown {
  if (val === null || val === undefined) return null;

  if (val instanceof xdr.ScVal) return scValToNative(val);

  if (typeof val === 'object' && 'value' in (val as object)) {
    const inner = (val as { value: unknown }).value;
    if (inner instanceof xdr.ScVal) return scValToNative(inner);
    return inner;
  }

  if (typeof val === 'string') {
    try {
      return scValToNative(xdr.ScVal.fromXDR(val, 'base64'));
    } catch {
      return val;
    }
  }

  return val;
}
