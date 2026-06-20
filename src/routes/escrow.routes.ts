import express from 'express';
import { getEscrow, releaseEscrow, refundEscrow, createEscrowDispute } from '../controllers/escrow.controller';
import { authenticate } from '../middlewares/authenticate';

const router = express.Router();

router.get('/:id', authenticate, getEscrow);
router.post('/:id/release', authenticate, releaseEscrow);
router.post('/:id/refund', authenticate, refundEscrow);
router.post('/:id/dispute', authenticate, createEscrowDispute);

export default router;
