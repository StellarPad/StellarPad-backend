import express from 'express';
import { searchListings, getListingDetails } from '../controllers/listings.controller';

const router = express.Router();

router.get('/', searchListings);
router.get('/:id', getListingDetails);

export default router;
