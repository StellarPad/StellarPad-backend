import app from './app';
import { env } from './config/env';
import { checkStellarConnectivity } from './services/stellar.service';
import { startIngestionWorker } from './workers/ingestion.worker';

async function main() {
  // Verify Stellar / Horizon connectivity before accepting traffic
  try {
    await checkStellarConnectivity();
  } catch (err) {
    console.warn('[startup] Stellar connectivity check failed — continuing anyway:', err);
  }

  // Start on-chain event ingestion worker
  startIngestionWorker();

  app.listen(env.PORT, () => {
    console.log(`[server] StellarPad API running on port ${env.PORT} (${env.NODE_ENV})`);
  });
}

main().catch((err) => {
  console.error('[startup] fatal error:', err);
  process.exit(1);
});
