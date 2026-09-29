import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma CLI (migrate, db seed, studio) doğrudan bağlantıyı kullanır.
// Uygulama çalışırken ise havuzlanmış DATABASE_URL kullanılır (src/prisma/prisma.service.ts).
// `prisma generate` veritabanına bağlanmadığı için URL tanımlı olmasa da çalışır.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
