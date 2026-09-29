import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

// Örnek kullanıcılar Supabase Auth üzerinden kayıt olmalıdır (şifreler auth.users'ta tutulur),
// bu yüzden seed yalnızca kategorileri oluşturur.
const categories = [
  {
    name: 'Teknoloji',
    slug: 'teknoloji',
    description: 'Yazılım, donanım ve dijital dünya',
  },
  {
    name: 'Bilim',
    slug: 'bilim',
    description: 'Keşifler, araştırmalar ve merak edilenler',
  },
  {
    name: 'Sanat',
    slug: 'sanat',
    description: 'Edebiyat, müzik, sinema ve görsel sanatlar',
  },
  {
    name: 'Kültür',
    slug: 'kultur',
    description: 'Toplum, tarih ve gelenekler',
  },
  { name: 'Spor', slug: 'spor', description: 'Sporun her dalı' },
  {
    name: 'Kişisel Gelişim',
    slug: 'kisisel-gelisim',
    description: 'Öğrenme, verimlilik ve yaşam',
  },
  {
    name: 'Girişimcilik',
    slug: 'girisimcilik',
    description: 'İş fikirleri ve girişim dünyası',
  },
  {
    name: 'Gündem',
    slug: 'gundem',
    description: 'Güncel olaylar ve tartışmalar',
  },
];

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  }),
});

try {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, description: category.description },
      create: category,
    });
  }
  console.log(`${categories.length} kategori hazır.`);
} finally {
  await prisma.$disconnect();
}
