import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { errorHandler } from './middlewares/errorHandler';

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
import exchangeRouter from './routes/exchange.routes';
import reservationsRouter from './routes/reservations.routes';

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

// ── Global Error Handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

export default app;
