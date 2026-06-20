import express from 'express';
import { searchListings, getListingDetails } from '../controllers/listings.controller';
import { listReservationsForListing } from '../controllers/reservations.controller';
import { authenticate } from '../middlewares/authenticate';

const router = express.Router();

router.get('/', searchListings);
router.get('/:id', getListingDetails);
router.get('/:listingId/reservations', authenticate, listReservationsForListing);

export default router;
