import express from 'express';
import { getSavingsAnalytics } from '../controllers/analytics.controller';

const router = express.Router();

router.get('/savings', getSavingsAnalytics);

export default router;
