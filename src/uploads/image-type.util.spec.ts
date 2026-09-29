import { detectImageType } from './image-type.util.js';

const pad = (bytes: number[]) =>
  Buffer.concat([Buffer.from(bytes), Buffer.alloc(16)]);

describe('detectImageType', () => {
  it.each([
    ['jpeg', pad([0xff, 0xd8, 0xff, 0xe0]), { mime: 'image/jpeg', ext: 'jpg' }],
    [
      'png',
      pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      { mime: 'image/png', ext: 'png' },
    ],
    ['gif', pad([...Buffer.from('GIF89a')]), { mime: 'image/gif', ext: 'gif' }],
    [
      'webp',
      pad([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP')]),
      { mime: 'image/webp', ext: 'webp' },
    ],
  ])('%s tanınır', (_name, buffer, expected) => {
    expect(detectImageType(buffer)).toEqual(expected);
  });

  it.each([
    [
      'svg (XSS riski)',
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">'),
    ],
    ['html', Buffer.from('<!doctype html><script>alert(1)</script>')],
    ['çok kısa', Buffer.from([0xff, 0xd8])],
  ])('%s reddedilir', (_name, buffer) => {
    expect(detectImageType(buffer)).toBeNull();
  });
});
