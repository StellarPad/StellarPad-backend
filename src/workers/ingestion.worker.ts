import { prisma } from '../config/prisma';
import { sorobanRpc } from '../services/stellar.service';
import { processContractEvents } from './handlers/event.dispatcher';

const POLL_INTERVAL_MS = 5_000;
const CURSOR_KEY = 'ingestion_cursor';

let running = false;
let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Retrieves the last processed ledger sequence from DB,
 * so the worker resumes correctly after restarts.
 */
async function getCursor(): Promise<number> {
  const row = await prisma.ingestionCursor.findUnique({ where: { key: CURSOR_KEY } });
  return row?.ledgerSequence ?? 0;
}

async function saveCursor(ledgerSequence: number): Promise<void> {
  await prisma.ingestionCursor.upsert({
    where: { key: CURSOR_KEY },
    update: { ledgerSequence },
    create: { key: CURSOR_KEY, ledgerSequence },
  });
}

async function tick(): Promise<void> {
  try {
    const cursor = await getCursor();
    const latestLedger = await sorobanRpc.getLatestLedger();
    const latest = latestLedger.sequence;

    if (latest <= cursor) return;

    console.log(`[ingestion] processing ledgers ${cursor + 1} → ${latest}`);

    const events = await sorobanRpc.getEvents({
      startLedger: cursor + 1,
      filters: [],
    });

    if (events.events.length > 0) {
      await processContractEvents(events.events);
    }

    await saveCursor(latest);
  } catch (err) {
    // Log and continue — never crash the loop on transient errors
    console.error('[ingestion] tick error:', err);
  }
}

export function startIngestionWorker(): void {
  if (running) return;
  running = true;
  console.log('[ingestion] worker started');

  const schedule = () => {
    timer = setTimeout(async () => {
      await tick();
      if (running) schedule(); // re-schedule only if still running (no setInterval leak)
    }, POLL_INTERVAL_MS);
  };

  schedule();
}

export function stopIngestionWorker(): void {
  running = false;
  if (timer) clearTimeout(timer);
  timer = null;
  console.log('[ingestion] worker stopped');
}
