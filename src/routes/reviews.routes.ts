import express from 'express';
import { createReview } from '../controllers/reviews.controller';
import { authenticate } from '../middlewares/authenticate';

const router = express.Router();

router.post('/', authenticate, createReview);

export default router;
