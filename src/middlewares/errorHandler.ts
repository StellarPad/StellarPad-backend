import { ErrorRequestHandler } from 'express';
import { HttpError } from '../utils/HttpError';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Internal server error' });
};
