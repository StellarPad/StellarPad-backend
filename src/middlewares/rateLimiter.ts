import rateLimit from 'express-rate-limit';

/** Global limiter: 200 req / 15 min per IP */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
});

/** Stricter limiter for auth endpoints: 20 req / 15 min per IP */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_auth_requests' },
});

/** Write-action limiter: 60 req / 15 min per IP */
export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_write_requests' },
});
