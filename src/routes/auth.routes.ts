import express from 'express';
import { registerPasskey, getChallenge, verifyChallenge } from '../controllers/auth.controller';
import { authLimiter } from '../middlewares/rateLimiter';
import { validateBody } from '../middlewares/validate';

const router = express.Router();

router.get('/challenge/:address', authLimiter, getChallenge);
router.post('/verify', authLimiter, validateBody([{ field: 'address' }, { field: 'signature' }]), verifyChallenge);
router.post('/passkey-register', authLimiter, validateBody([{ field: 'stellarAddress' }, { field: 'webauthnId' }, { field: 'publicKey' }]), registerPasskey);

export default router;
