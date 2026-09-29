import { Prisma } from '../generated/prisma/client.js';
import { toggleRelation } from './toggle.js';

const uniqueError = () =>
  new Prisma.PrismaClientKnownRequestError('unique', {
    code: 'P2002',
    clientVersion: '7',
  });

describe('toggleRelation', () => {
  it('kayıt varsa siler ve false döner', async () => {
    const create = vi.fn();
    await expect(
      toggleRelation(async () => ({ count: 1 }), create),
    ).resolves.toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it('kayıt yoksa oluşturur ve true döner', async () => {
    const create = vi.fn().mockResolvedValue({});
    await expect(
      toggleRelation(async () => ({ count: 0 }), create),
    ).resolves.toBe(true);
    expect(create).toHaveBeenCalledOnce();
  });

  it('eşzamanlı oluşturmada benzersizlik hatasını yutar', async () => {
    await expect(
      toggleRelation(
        async () => ({ count: 0 }),
        () => Promise.reject(uniqueError()),
      ),
    ).resolves.toBe(true);
  });

  it('diğer hataları iletir', async () => {
    await expect(
      toggleRelation(
        async () => ({ count: 0 }),
        () => Promise.reject(new Error('bağlantı koptu')),
      ),
    ).rejects.toThrow('bağlantı koptu');
  });
});
