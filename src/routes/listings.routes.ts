import express from 'express';
import { searchListings } from '../controllers/listings.controller';

const router = express.Router();

router.get('/', searchListings);

export default router;
