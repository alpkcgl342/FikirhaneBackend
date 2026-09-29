import { containsInsensitive, escapeLike } from './like.js';

describe('escapeLike', () => {
  it.each([
    ['%%', '\\%\\%'],
    ['a_b', 'a\\_b'],
    ['c:\\yol', 'c:\\\\yol'],
    ['yapay zeka', 'yapay zeka'],
  ])('%s → %s', (input, expected) => {
    expect(escapeLike(input)).toBe(expected);
  });

  it('containsInsensitive kaçışlanmış, duyarsız filtre üretir', () => {
    expect(containsInsensitive('50%')).toEqual({
      contains: '50\\%',
      mode: 'insensitive',
    });
  });
});
