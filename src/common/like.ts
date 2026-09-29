/**
 * Prisma'nın `contains` filtresi SQL LIKE'a çevrilir ve `%`, `_` joker karakterlerini
 * kaçışlamaz; "%%" araması her şeyle eşleşirdi. PostgreSQL'in varsayılan kaçış
 * karakteri olan `\` ile bu karakterler düz metin hâline getirilir.
 */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, '\\$&');
}

/** Büyük/küçük harf duyarsız "içerir" filtresi (joker karakterler kaçışlanmış). */
export function containsInsensitive(term: string) {
  return { contains: escapeLike(term), mode: 'insensitive' as const };
}
