export interface ImageType {
  mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  ext: 'jpg' | 'png' | 'webp' | 'gif';
}

/**
 * Dosya türünü istemcinin bildirdiği Content-Type'a değil, dosyanın ilk baytlarına
 * (magic bytes) bakarak belirler. Desteklenmeyen türlerde null döner.
 */
export function detectImageType(buffer: Buffer): ImageType | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  if (
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (buffer.toString('ascii', 0, 4) === 'GIF8') {
    return { mime: 'image/gif', ext: 'gif' };
  }
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  return null;
}
