import express from 'express';
import { registerPasskey, getChallenge, verifyChallenge } from '../controllers/auth.controller';

const router = express.Router();

router.get('/challenge/:address', getChallenge);
router.post('/verify', verifyChallenge);
router.post('/passkey-register', registerPasskey);

export default router;
