import express from 'express';
import { searchListings, getListingDetails } from '../controllers/listings.controller';
import { listReservationsForListing } from '../controllers/reservations.controller';
import { listLeasesForListing } from '../controllers/leases.controller';
import { getListingReviews } from '../controllers/reviews.controller';
import { authenticate } from '../middlewares/authenticate';

const router = express.Router();

router.get('/', searchListings);
router.get('/:id', getListingDetails);
router.get('/:listingId/reservations', authenticate, listReservationsForListing);
router.get('/:listingId/leases', authenticate, listLeasesForListing);
router.get('/:listingId/reviews', getListingReviews);

export default router;
