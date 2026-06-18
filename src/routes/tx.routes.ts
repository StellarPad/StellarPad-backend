import express from 'express';
import { createUnsignedBookingTx } from '../controllers/tx.controller';

const router = express.Router();

router.post('/unsigned/booking', createUnsignedBookingTx);

export default router;
