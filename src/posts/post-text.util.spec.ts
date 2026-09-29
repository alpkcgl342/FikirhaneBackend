import {
  excerpt,
  normalizeTags,
  readingTime,
  slugify,
  stripMarkdown,
  uniqueSlug,
} from './post-text.util.js';

describe('post-text.util', () => {
  describe('slugify', () => {
    it.each([
      ["Yapay Zekâ'ya Giriş!", 'yapay-zekaya-giris'],
      ['İstanbul’da Çay Ölçüsü Şu: Ğ Ü ı', 'istanbulda-cay-olcusu-su-g-u-i'],
      ['  --Merhaba   Dünya--  ', 'merhaba-dunya'],
      ['!!!', ''],
    ])('%s → %s', (input, expected) => {
      expect(slugify(input)).toBe(expected);
    });

    it('80 karakteri aşmaz ve tire ile bitmez', () => {
      const slug = slugify('kelime '.repeat(40));
      expect(slug.length).toBeLessThanOrEqual(80);
      expect(slug.endsWith('-')).toBe(false);
    });
  });

  it('uniqueSlug rastgele 6 haneli ek ekler, boş başlıkta "yazi" kullanır', () => {
    expect(uniqueSlug('Merhaba Dünya')).toMatch(/^merhaba-dunya-[0-9a-f]{6}$/);
    expect(uniqueSlug('???')).toMatch(/^yazi-[0-9a-f]{6}$/);
  });

  it('stripMarkdown biçimlendirmeyi, kodu ve HTML etiketlerini temizler', () => {
    const md =
      '# Başlık\n\n**kalın** ve _italik_ [bağlantı](https://x.com)\n\n```js\nkod()\n```\n![görsel](a.png) <script>x</script>';
    expect(stripMarkdown(md)).toBe('Başlık kalın ve italik bağlantı x');
  });

  it('readingTime dakikada 200 kelimeye göre yukarı yuvarlar, en az 1', () => {
    expect(readingTime('')).toBe(1);
    expect(readingTime('kelime '.repeat(200))).toBe(1);
    expect(readingTime('kelime '.repeat(201))).toBe(2);
  });

  it('excerpt kelime ortasından kesmez', () => {
    expect(excerpt('kısa metin')).toBe('kısa metin');
    const long = excerpt('aaaa bbbb cccc', 11);
    expect(long).toBe('aaaa bbbb…');
  });

  it('normalizeTags Türkçe küçük harfe çevirir, boşları ve tekrarları atar', () => {
    expect(
      normalizeTags(['  Yapay   Zeka ', 'yapay zeka', 'İNSAN', '', 'Işık']),
    ).toEqual(['yapay zeka', 'insan', 'ışık']);
  });
});
