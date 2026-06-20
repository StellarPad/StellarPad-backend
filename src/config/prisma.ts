import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { env } from './env';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (PrismaClient as any)({
    datasourceUrl: env.DATABASE_URL,
    log: env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  }) as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
