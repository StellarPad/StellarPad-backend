import { prisma } from '../config/prisma';

/**
 * Try to mark an event (id + txHash) as ingested.
 * Returns true if this call created the marker (first time), false if it already existed.
 */
export async function tryMarkIngested(eventId: string, txHash: string): Promise<boolean> {
  try {
    await prisma.ingestedEvent.create({ data: { id: eventId, txHash } });
    return true;
  } catch (err: any) {
    // Prisma unique constraint violation code is P2002
    if (err?.code === 'P2002') return false;
    // On other errors, rethrow so the worker can log and handle them
    throw err;
  }
}
