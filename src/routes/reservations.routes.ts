import express from 'express';
import { createReservation, getReservation, updateReservationStatus } from '../controllers/reservations.controller';
import { getEscrowForReservation } from '../controllers/escrow.controller';
import { authenticate } from '../middlewares/authenticate';
import { writeLimiter } from '../middlewares/rateLimiter';
import { validateBody } from '../middlewares/validate';

const router = express.Router();

router.post('/', authenticate, writeLimiter, validateBody([
  { field: 'listingId' },
  { field: 'guestAddress' },
  { field: 'checkIn' },
  { field: 'checkOut' },
  { field: 'totalAmount' },
]), createReservation);
router.get('/:id', authenticate, getReservation);
router.patch('/:id/status', authenticate, validateBody([{ field: 'status' }]), updateReservationStatus);
router.get('/:reservationId/escrow', authenticate, getEscrowForReservation);

export default router;
