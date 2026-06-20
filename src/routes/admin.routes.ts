import express from 'express';
import { getPlatformStats, resolveDispute, listOpenDisputes } from '../controllers/admin.controller';
import { authenticate, requireRole } from '../middlewares/authenticate';
import { validateBody } from '../middlewares/validate';

const router = express.Router();

// All admin routes require a valid JWT with role=admin
router.use(authenticate, requireRole('admin'));

router.get('/stats', getPlatformStats);
router.get('/disputes', listOpenDisputes);
router.post('/disputes/:claimId/resolve', validateBody([{ field: 'resolution' }]), resolveDispute);

export default router;
