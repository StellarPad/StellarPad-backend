import express from 'express';
import {
  createReservation,
  getReservation,
  updateReservationStatus,
} from '../controllers/reservations.controller';
import { getEscrowForReservation } from '../controllers/escrow.controller';
import { authenticate } from '../middlewares/authenticate';

const router = express.Router();

router.post('/', authenticate, createReservation);
router.get('/:id', authenticate, getReservation);
router.patch('/:id/status', authenticate, updateReservationStatus);
router.get('/:reservationId/escrow', authenticate, getEscrowForReservation);

export default router;
