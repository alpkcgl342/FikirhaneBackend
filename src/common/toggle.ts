import { Prisma } from '../generated/prisma/client.js';

/**
 * Beğeni/kaydetme/takip gibi (kullanıcı, hedef) çiftleri için aç-kapa.
 * Kayıt varsa silinir (false döner), yoksa oluşturulur (true döner).
 * Aynı anda gelen iki "aç" isteğinde ikinci oluşturma benzersizlik hatası verir;
 * sonuç yine "açık" olduğu için bu hata yutulur.
 */
export async function toggleRelation(
  remove: () => Promise<{ count: number }>,
  create: () => Promise<unknown>,
): Promise<boolean> {
  const { count } = await remove();
  if (count > 0) return false;
  try {
    await create();
  } catch (e) {
    const alreadyExists =
      e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
    if (!alreadyExists) throw e;
  }
  return true;
}
