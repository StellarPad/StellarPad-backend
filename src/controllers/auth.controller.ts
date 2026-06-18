import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

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
