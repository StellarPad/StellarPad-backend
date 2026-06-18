import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env['CORS_ORIGIN'] ?? '*', credentials: true }));

// ── Parsing ───────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'stellar-pad-backend' });
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

app.use('/api/tx', txRouter);
app.use('/api/listings', listingsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/users', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/escrows', escrowRouter);
app.use('/api/listings', listingWizardRouter);

// ── Global Error Handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

export default app;
