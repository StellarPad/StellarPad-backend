import express from 'express';
import { getSavingsAnalytics, getRevenueBreakdown, getTopListings } from '../controllers/analytics.controller';

const router = express.Router();

router.get('/savings', getSavingsAnalytics);
router.get('/revenue', getRevenueBreakdown);
router.get('/listings/top', getTopListings);

export default router;
