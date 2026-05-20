import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function getDbUrl(): string {
  // Vercel serverless ortamında: Kaynak DB'yi okunabilir /tmp'ye kopyala
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    const sourcePath = path.join(process.cwd(), 'prisma', 'dev.db');
    const tmpPath = '/tmp/dev.db';

    // Sadece dosya yoksa kopyala (her cold start'ta bir kez yeterli)
    if (!fs.existsSync(tmpPath)) {
      try {
        fs.copyFileSync(sourcePath, tmpPath);
        console.log('[prisma] dev.db kopyalandı:', sourcePath, '->', tmpPath);
      } catch (e) {
        console.error('[prisma] dev.db kopyalama hatası:', e);
        // Kopyalama başarısız olursa kaynak yola dön
        return `file:${sourcePath}`;
      }
    }
    return `file:${tmpPath}`;
  }

  // Yerel geliştirme ortamı
  const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
  return `file:${dbPath}`;
}

const dbUrl = getDbUrl();

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
    log: process.env.NODE_ENV !== 'production' ? ['query'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
