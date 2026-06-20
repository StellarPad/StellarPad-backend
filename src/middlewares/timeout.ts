import { Request, Response, NextFunction } from 'express';

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Middleware that aborts a request with 503 if the handler hasn't responded
 * within `timeoutMs` milliseconds.
 */
export function requestTimeout(timeoutMs = DEFAULT_TIMEOUT_MS) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(503).json({ error: 'request_timeout' });
      }
    }, timeoutMs);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    next();
  };
}
