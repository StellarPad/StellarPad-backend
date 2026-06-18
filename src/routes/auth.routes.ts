import express from 'express';
import { registerPasskey } from '../controllers/auth.controller';

const router = express.Router();

router.post('/passkey-register', registerPasskey);

export default router;
