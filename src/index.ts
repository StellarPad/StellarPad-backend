import http from 'http';
import app from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { checkStellarConnectivity } from './services/stellar.service';
import { startIngestionWorker, stopIngestionWorker } from './workers/ingestion.worker';

async function main() {
  try {
    await checkStellarConnectivity();
  } catch (err) {
    console.warn('[startup] Stellar connectivity check failed — continuing anyway:', err);
  }

  startIngestionWorker();

  const server = http.createServer(app);

  server.listen(env.PORT, () => {
    console.log(`[server] StellarPad API running on port ${env.PORT} (${env.NODE_ENV})`);
  });

  async function shutdown(signal: string) {
    console.log(`[server] ${signal} received — shutting down gracefully`);
    stopIngestionWorker();

    server.close(async () => {
      await prisma.$disconnect();
      console.log('[server] shutdown complete');
      process.exit(0);
    });

    // Force-exit if server hasn't closed within 10 seconds
    setTimeout(() => {
      console.error('[server] forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[startup] fatal error:', err);
  process.exit(1);
});
