import { PrismaClient } from '@prisma/client';
import path from 'path';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Vercel serverless ortamında dosya yolu uyuşmazlığını çözmek için 
// veritabanı yolunu process.cwd() üzerinden dinamik olarak belirliyoruz.
const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: `file:${dbPath}`,
      },
    },
    log: ['query'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
