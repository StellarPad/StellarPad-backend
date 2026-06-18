import { ErrorRequestHandler } from 'express';
import { HttpError } from '../utils/HttpError';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    console.warn('[http-error]', { message: err.message, path: req.path, status: err.statusCode });
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  console.error('[unhandled]', { path: req.path, message: err?.message ?? 'unknown', stack: err?.stack });
  res.status(500).json({ error: 'Internal server error' });
};
