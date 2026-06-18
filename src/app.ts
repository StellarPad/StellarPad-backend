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

app.use('/api/tx', txRouter);

// ── Global Error Handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

export default app;
