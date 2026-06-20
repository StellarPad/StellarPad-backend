import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { LeaseStatus } from '@prisma/client';
import { HttpError } from '../utils/HttpError';

export async function getLease(req: Request, res: Response): Promise<void> {
  const id = String(req.params['id'] ?? '');

  const lease = await prisma.lease.findFirst({
    where: { OR: [{ id }, { onChainLeaseId: id }] },
  });

  if (!lease) throw new HttpError(404, 'lease_not_found');
  res.json({ lease });
}

export async function listLeasesForListing(req: Request, res: Response): Promise<void> {
  const listingId = String(req.params['listingId'] ?? '');
  const limit = Number(req.query.limit ?? 20);
  const offset = Number(req.query.offset ?? 0);

  const [total, items] = await Promise.all([
    prisma.lease.count({ where: { listingId } }),
    prisma.lease.findMany({
      where: { listingId },
      skip: offset,
      take: limit,
      orderBy: { startedAt: 'desc' },
    }),
  ]);

  res.json({ total, items });
}

export async function terminateLease(req: Request, res: Response): Promise<void> {
  const id = String(req.params['id'] ?? '');
  const { totalStreamed } = req.body;

  const lease = await prisma.lease.findFirst({
    where: { OR: [{ id }, { onChainLeaseId: id }] },
  });

  if (!lease) throw new HttpError(404, 'lease_not_found');
  if (lease.status === LeaseStatus.TERMINATED || lease.status === LeaseStatus.COMPLETED) {
    throw new HttpError(409, 'lease_already_ended');
  }

  const updated = await prisma.lease.update({
    where: { id: lease.id },
    data: {
      status: LeaseStatus.TERMINATED,
      endedAt: new Date(),
      totalStreamed: totalStreamed ? String(totalStreamed) : lease.totalStreamed,
      lastSyncedAt: new Date(),
    },
  });

  res.json({ lease: updated });
}
