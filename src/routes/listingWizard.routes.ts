import express from 'express';
import { createListingDraft, getDraft, buildPublishXDR } from '../controllers/listingWizard.controller';
import { authenticate } from '../middlewares/authenticate';

const router = express.Router();

router.post('/wizard/create', authenticate, createListingDraft);
router.get('/wizard/:draftId', authenticate, getDraft);
router.post('/wizard/publish-xdr', authenticate, buildPublishXDR);

export default router;
