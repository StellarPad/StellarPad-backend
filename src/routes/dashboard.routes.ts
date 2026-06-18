import express from 'express';
import { getTenantDashboard } from '../controllers/dashboard.controller';
import { getLandlordDashboard } from '../controllers/landlord.controller';

const router = express.Router();

router.get('/tenant', getTenantDashboard);
router.get('/landlord', getLandlordDashboard);

export default router;
