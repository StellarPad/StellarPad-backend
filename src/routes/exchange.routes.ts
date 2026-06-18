import express from 'express';
import { convertRate } from '../controllers/exchange.controller';

const router = express.Router();

router.get('/convert', convertRate);

export default router;
