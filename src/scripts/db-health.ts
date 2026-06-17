/**
 * Database connection health test harness.
 * Run: npx ts-node src/scripts/db-health.ts
 */
import 'dotenv/config';
import { prisma } from '../config/prisma';

async function checkDbHealth() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('[db-health] ✅ PostgreSQL connection successful');
  } catch (err) {
    console.error('[db-health] ❌ Connection failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkDbHealth();
