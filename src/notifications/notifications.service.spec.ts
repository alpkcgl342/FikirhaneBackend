import type { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.service.js';

const actor = {
  id: 'actor',
  username: 'ayse',
  displayName: 'Ayşe',
  avatarUrl: null,
};
const post = { id: 'p1', slug: 'yazi', title: 'Yazı' };

function setup() {
  const prisma = {
    notification: { count: vi.fn().mockResolvedValue(0), create: vi.fn() },
    user: { findUnique: vi.fn().mockResolvedValue(actor) },
  };
  const service = new NotificationsService(prisma as unknown as PrismaService);
  return { service, prisma };
}

describe('NotificationsService.notify', () => {
  it('kişi kendi işlemi için bildirim almaz', async () => {
    const { service, prisma } = setup();

    await service.notify({
      type: 'LIKE',
      recipientId: 'actor',
      actorId: 'actor',
      post,
    });

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('beğeni bildirimini aktör ve yazı bilgisiyle oluşturur', async () => {
    const { service, prisma } = setup();

    await service.notify({
      type: 'LIKE',
      recipientId: 'yazar',
      actorId: 'actor',
      post,
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { userId: 'yazar', type: 'LIKE', data: { actor, post } },
    });
  });

  it('aynı kişinin aynı yazıya tekrar beğenisi yeni bildirim üretmez', async () => {
    const { service, prisma } = setup();
    prisma.notification.count.mockResolvedValue(1);

    await service.notify({
      type: 'LIKE',
      recipientId: 'yazar',
      actorId: 'actor',
      post,
    });

    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: {
        userId: 'yazar',
        type: 'LIKE',
        AND: [
          { data: { path: ['actor', 'id'], equals: 'actor' } },
          { data: { path: ['post', 'id'], equals: 'p1' } },
        ],
      },
    });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('yorum bildirimleri tekrar kontrolü yapmaz', async () => {
    const { service, prisma } = setup();

    await service.notify({
      type: 'COMMENT',
      recipientId: 'yazar',
      actorId: 'actor',
      post,
      commentId: 'c1',
      reply: true,
    });

    expect(prisma.notification.count).not.toHaveBeenCalled();
    expect(prisma.notification.create.mock.calls[0][0].data.data).toEqual({
      actor,
      post,
      commentId: 'c1',
      reply: true,
    });
  });

  it('veritabanı hatası asıl işlemi bozmaz', async () => {
    const { service, prisma } = setup();
    prisma.notification.create.mockRejectedValue(new Error('bağlantı koptu'));

    await expect(
      service.notify({ type: 'FOLLOW', recipientId: 'u2', actorId: 'actor' }),
    ).resolves.toBeUndefined();
  });
});
