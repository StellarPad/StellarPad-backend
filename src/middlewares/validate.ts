import { Request, Response, NextFunction } from 'express';
import { HttpError } from '../utils/HttpError';

type Rule = {
  field: string;
  type?: 'string' | 'number' | 'boolean';
  min?: number;
  max?: number;
};

/**
 * Returns a middleware that validates request body fields.
 * Throws HttpError(400) on first violation.
 */
export function validateBody(rules: Rule[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    for (const rule of rules) {
      const val = req.body?.[rule.field];

      if (val === undefined || val === null || val === '') {
        return next(new HttpError(400, `missing_field:${rule.field}`));
      }

      if (rule.type === 'number') {
        const n = Number(val);
        if (Number.isNaN(n)) return next(new HttpError(400, `invalid_number:${rule.field}`));
        if (rule.min !== undefined && n < rule.min) return next(new HttpError(400, `too_small:${rule.field}`));
        if (rule.max !== undefined && n > rule.max) return next(new HttpError(400, `too_large:${rule.field}`));
      }

      if (rule.type === 'string') {
        const s = String(val);
        if (rule.min !== undefined && s.length < rule.min) return next(new HttpError(400, `too_short:${rule.field}`));
        if (rule.max !== undefined && s.length > rule.max) return next(new HttpError(400, `too_long:${rule.field}`));
      }
    }
    next();
  };
}

/** Validates a Stellar G... public key format (56 chars, starts with G). */
export function validateStellarAddress(field: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const val = String(req.body?.[field] ?? req.params?.[field] ?? '');
    if (!/^G[A-Z2-7]{55}$/.test(val)) {
      return next(new HttpError(400, `invalid_stellar_address:${field}`));
    }
    next();
  };
}
