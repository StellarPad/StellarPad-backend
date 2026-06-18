import express from 'express';
import { createEscrowDispute } from '../controllers/escrow.controller';

const router = express.Router();

router.post('/:id/dispute', createEscrowDispute);

export default router;
