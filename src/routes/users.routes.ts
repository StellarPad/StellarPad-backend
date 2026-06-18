import express from 'express';
import { getUserReputation } from '../controllers/users.controller';

const router = express.Router();

router.get('/:address/reputation', getUserReputation);

export default router;
