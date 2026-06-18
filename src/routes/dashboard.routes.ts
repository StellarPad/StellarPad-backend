import express from 'express';
import { getTenantDashboard } from '../controllers/dashboard.controller';

const router = express.Router();

router.get('/tenant', getTenantDashboard);

export default router;
