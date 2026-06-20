import express from 'express';
import { upsertUser, getPublicProfile, getUserReputation } from '../controllers/users.controller';
import { authenticate } from '../middlewares/authenticate';

const router = express.Router();

router.post('/', authenticate, upsertUser);
router.get('/:address', getPublicProfile);
router.get('/:address/reputation', getUserReputation);

export default router;
