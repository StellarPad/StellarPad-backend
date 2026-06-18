import express from 'express';
import { createListingDraft } from '../controllers/listingWizard.controller';

const router = express.Router();

router.post('/create', createListingDraft);

export default router;
