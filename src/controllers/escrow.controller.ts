import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

export async function createEscrowDispute(req: Request, res: Response): Promise<void> {
  const { escrowId, claimantAddress, description, metadata } = req.body;

  if (!escrowId || !claimantAddress || !description) {
    res.status(400).json({ error: 'missing_required_fields' });
    return;
  }

  const escrow = await prisma.escrow.findUnique({ where: { id: escrowId } });
  if (!escrow) {
    res.status(404).json({ error: 'escrow_not_found' });
    return;
  }

  const claim = await prisma.escrowClaim.create({
    data: {
      escrowId,
      claimantAddress,
      description,
      metadata: metadata ?? null,
      status: 'OPEN',
    },
  });

  await prisma.escrow.update({
    where: { id: escrowId },
    data: { status: 'DISPUTED' },
  });

  res.status(201).json({ claim });
}
