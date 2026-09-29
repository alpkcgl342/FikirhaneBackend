import { randomBytes } from 'node:crypto';

const TURKISH_CHARS: Record<string, string> = {
  ç: 'c',
  Ç: 'c',
  ğ: 'g',
  Ğ: 'g',
  ı: 'i',
  İ: 'i',
  ö: 'o',
  Ö: 'o',
  ş: 's',
  Ş: 's',
  ü: 'u',
  Ü: 'u',
};

const WORDS_PER_MINUTE = 200;

/** "Yapay Zekâ'ya Giriş!" → "yapay-zekaya-giris" */
export function slugify(text: string): string {
  return text
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => TURKISH_CHARS[c])
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

/** Başlıktan benzersizliği yüksek bir slug üretir: "yapay-zekaya-giris-3f9a1c" */
export function uniqueSlug(title: string): string {
  const base = slugify(title) || 'yazi';
  return `${base}-${randomBytes(3).toString('hex')}`;
}

/** Markdown'ı düz metne indirger (okuma süresi ve özet için; HTML üretmez). */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Dakika cinsinden tahmini okuma süresi (en az 1). */
export function readingTime(markdown: string): number {
  const words = stripMarkdown(markdown).split(' ').filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

export function excerpt(markdown: string, maxLength = 200): string {
  const text = stripMarkdown(markdown);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).replace(/\s+\S*$/, '')}…`;
}

/** Etiketleri kırpar, Türkçe kurallarıyla küçük harfe çevirir ve tekrarları atar. */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  for (const tag of tags) {
    const name = tag.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr');
    if (name) seen.add(name);
  }
  return [...seen];
}
