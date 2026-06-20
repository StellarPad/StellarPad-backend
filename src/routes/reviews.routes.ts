import express from 'express';
import { createReview } from '../controllers/reviews.controller';
import { authenticate } from '../middlewares/authenticate';
import { writeLimiter } from '../middlewares/rateLimiter';
import { validateBody } from '../middlewares/validate';

const router = express.Router();

router.post('/', authenticate, writeLimiter, validateBody([
  { field: 'listingId' },
  { field: 'authorAddress' },
  { field: 'targetAddress' },
  { field: 'rating', type: 'number', min: 1, max: 5 },
  { field: 'comment', type: 'string', min: 1, max: 2000 },
]), createReview);

export default router;
