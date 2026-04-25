#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Prisma/Postgres smoke check...');

  await prisma.$queryRaw`SELECT 1`;

  const [userCount, circleCount] = await Promise.all([
    prisma.user.count(),
    prisma.circle.count(),
  ]);

  console.log(`Smoke OK: users=${userCount}, circles=${circleCount}`);
}

main()
  .catch((error) => {
    console.error('Smoke FAILED:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
