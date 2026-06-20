import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { errorHandler } from './middlewares/errorHandler';
import { prisma } from './config/prisma';
import { sorobanRpc } from './services/stellar.service';
import { globalLimiter } from './middlewares/rateLimiter';

const app = express();

// ── Performance ─────────────────────────────────────────────────────────────────
app.use(compression());
app.use(morgan(process.env['NODE_ENV'] === 'production' ? 'combined' : 'dev'));

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env['CORS_ORIGIN'] ?? '*', credentials: true }));

// ── Parsing ───────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Rate Limiting ─────────────────────────────────────────────────────────────
app.use(globalLimiter);

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  const checks: Record<string, string> = { api: 'ok' };

  // DB check
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks['db'] = 'ok';
  } catch {
    checks['db'] = 'error';
  }

  // Stellar RPC check
  try {
    const health = await sorobanRpc.getHealth();
    checks['stellar'] = health.status === 'healthy' ? 'ok' : 'degraded';
  } catch {
    checks['stellar'] = 'error';
  }

  const allOk = Object.values(checks).every((v) => v === 'ok');
  res.status(allOk ? 200 : 503).json({ status: allOk ? 'ok' : 'degraded', checks, ts: new Date().toISOString() });
});

// ── Routes (mounted in subsequent steps) ─────────────────────────────────────
import txRouter from './routes/tx.routes';
import listingsRouter from './routes/listings.routes';
import analyticsRouter from './routes/analytics.routes';
import usersRouter from './routes/users.routes';
import authRouter from './routes/auth.routes';
import dashboardRouter from './routes/dashboard.routes';
import escrowRouter from './routes/escrow.routes';
import listingWizardRouter from './routes/listingWizard.routes';
import exchangeRouter from './routes/exchange.routes';
import reservationsRouter from './routes/reservations.routes';
import leasesRouter from './routes/leases.routes';
import reviewsRouter from './routes/reviews.routes';
import adminRouter from './routes/admin.routes';

app.use('/api/tx', txRouter);
app.use('/api/listings', listingsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/users', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/escrows', escrowRouter);
app.use('/api/listings', listingWizardRouter);
app.use('/api/rates', exchangeRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/leases', leasesRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/admin', adminRouter);

// ── Global Error Handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

export default app;
