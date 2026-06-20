import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { Keypair } from '@stellar/stellar-sdk';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';

// In-memory nonce store — replace with Redis in production
const nonceStore = new Map<string, { nonce: string; expiresAt: number }>();

export async function getChallenge(req: Request, res: Response): Promise<void> {
  const address = String(req.params['address'] ?? '');
  if (!address) {
    res.status(400).json({ error: 'missing_address' });
    return;
  }

  const nonce = crypto.randomBytes(32).toString('hex');
  nonceStore.set(address, { nonce, expiresAt: Date.now() + 5 * 60_000 }); // 5 min TTL

  res.json({ nonce, message: `StellarPad auth: ${nonce}` });
}

export async function verifyChallenge(req: Request, res: Response): Promise<void> {
  const { address, signature } = req.body;
  if (!address || !signature) {
    res.status(400).json({ error: 'missing_required_fields' });
    return;
  }

  const stored = nonceStore.get(address);
  if (!stored || Date.now() > stored.expiresAt) {
    res.status(401).json({ error: 'nonce_expired_or_not_found' });
    return;
  }

  try {
    const keypair = Keypair.fromPublicKey(address);
    const message = Buffer.from(`StellarPad auth: ${stored.nonce}`);
    const sigBuffer = Buffer.from(signature, 'hex');
    const valid = keypair.verify(message, sigBuffer);

    if (!valid) {
      res.status(401).json({ error: 'invalid_signature' });
      return;
    }
  } catch {
    res.status(401).json({ error: 'invalid_signature' });
    return;
  }

  nonceStore.delete(address);

  // Upsert user
  const user = await prisma.user.upsert({
    where: { stellarAddress: address },
    update: {},
    create: { stellarAddress: address },
  });

  const token = jwt.sign(
    { sub: address, role: 'user', userId: user.id },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as string },
  );

  res.json({ token, user: { id: user.id, stellarAddress: user.stellarAddress } });
}

export async function registerPasskey(req: Request, res: Response): Promise<void> {
  const { stellarAddress, webauthnId, publicKey, transports, signCount } = req.body;

  if (!stellarAddress || !webauthnId || !publicKey) {
    res.status(400).json({ error: 'missing_required_fields' });
    return;
  }

  const user = await prisma.user.upsert({
    where: { stellarAddress },
    update: {},
    create: { stellarAddress },
  });

  const passkey = await prisma.passkey.upsert({
    where: { webauthnId },
    update: {
      publicKey,
      transports: transports ?? [],
      signCount: typeof signCount === 'number' ? signCount : 0,
      updatedAt: new Date(),
    },
    create: {
      userId: user.id,
      webauthnId,
      publicKey,
      transports: transports ?? [],
      signCount: typeof signCount === 'number' ? signCount : 0,
    },
  });

  res.json({ user: { id: user.id, stellarAddress: user.stellarAddress }, passkey: { id: passkey.id, webauthnId: passkey.webauthnId } });
}
