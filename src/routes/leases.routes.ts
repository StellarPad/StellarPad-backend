import express from 'express';
import { getLease, terminateLease } from '../controllers/leases.controller';
import { authenticate } from '../middlewares/authenticate';

const router = express.Router();

router.get('/:id', authenticate, getLease);
router.post('/:id/terminate', authenticate, terminateLease);

export default router;
