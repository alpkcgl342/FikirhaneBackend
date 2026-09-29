/** Yazı kapakları ve profil fotoğrafları için Supabase Storage kovası. */
export const POST_IMAGES_BUCKET = 'post-images';

/** Kovadaki dosyaların herkese açık adreslerinin ortak ön eki. */
export function publicImageUrlPrefix(supabaseUrl: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${POST_IMAGES_BUCKET}/`;
}

/**
 * Kapak ve profil görselleri yalnızca projenin kendi kovasından olabilir; böylece
 * sayfalara başka sitelerden (izleme pikseli vb.) görsel gömülemez.
 */
export function isOwnImageUrl(url: string, supabaseUrl: string): boolean {
  return url.startsWith(publicImageUrlPrefix(supabaseUrl));
}
