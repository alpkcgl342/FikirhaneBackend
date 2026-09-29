import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { SupabaseService } from '../supabase/supabase.service.js';
import { UsersService } from './users.service.js';

const SUPABASE_URL = 'https://proje.supabase.co';
const ME = { id: 'me', email: 'me@example.com' };

const dbUser = {
  id: 'u1',
  username: 'ayse',
  displayName: 'Ayşe',
  bio: null,
  avatarUrl: null,
  isBanned: false,
  createdAt: new Date('2026-09-29T00:00:00Z'),
  _count: { posts: 4, followers: 2, following: 1 },
};

function setup() {
  const prisma = {
    user: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    follow: {
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
  };
  const notifications = { notify: vi.fn() };
  const service = new UsersService(
    prisma as unknown as PrismaService,
    { projectUrl: SUPABASE_URL } as unknown as SupabaseService,
    notifications as unknown as NotificationsService,
  );
  return { service, prisma, notifications };
}

describe('UsersService', () => {
  describe('getProfile', () => {
    it('özel bilgiler olmadan sayılarla döner, takip durumunu ekler', async () => {
      const { service, prisma } = setup();
      prisma.user.findUnique.mockResolvedValue(dbUser);
      prisma.follow.findUnique.mockResolvedValue({ followerId: ME.id });

      const profile = await service.getProfile('Ayse', ME);

      expect(prisma.user.findUnique.mock.calls[0][0].where).toEqual({
        username: 'ayse',
      });
      expect(profile).toEqual({
        id: 'u1',
        username: 'ayse',
        displayName: 'Ayşe',
        bio: null,
        avatarUrl: null,
        isBanned: false,
        createdAt: dbUser.createdAt,
        postCount: 4,
        followerCount: 2,
        followingCount: 1,
        isMe: false,
        isFollowing: true,
      });
      expect(profile).not.toHaveProperty('email');
    });

    it('kullanıcı yoksa 404 döner', async () => {
      const { service, prisma } = setup();
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('yok')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateMe', () => {
    it('başka sitedeki profil fotoğrafını reddeder', async () => {
      const { service, prisma } = setup();

      await expect(
        service.updateMe(ME.id, { avatarUrl: 'https://kotu.site/a.png' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('boş biyografiyi temizler, yalnızca gönderilen alanları günceller', async () => {
      const { service, prisma } = setup();
      prisma.user.update.mockResolvedValue({
        ...dbUser,
        email: 'a@example.com',
        role: 'USER',
      });

      await service.updateMe(ME.id, { bio: '' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: ME.id },
        data: { bio: null },
      });
    });
  });

  describe('toggleFollow', () => {
    it('kendini takip edemez', async () => {
      const { service } = setup();
      await expect(service.toggleFollow(ME.id, ME.id)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('olmayan kullanıcıyı takip edemez', async () => {
      const { service, prisma } = setup();
      prisma.user.count.mockResolvedValue(0);

      await expect(service.toggleFollow('yok', ME.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('takip eder, bildirim gönderir ve güncel takipçi sayısını döner', async () => {
      const { service, prisma, notifications } = setup();
      prisma.user.count.mockResolvedValue(1);
      prisma.follow.deleteMany.mockResolvedValue({ count: 0 });
      prisma.follow.create.mockResolvedValue({});
      prisma.follow.count.mockResolvedValue(3);

      await expect(service.toggleFollow('u1', ME.id)).resolves.toEqual({
        following: true,
        followerCount: 3,
      });
      expect(prisma.follow.create).toHaveBeenCalledWith({
        data: { followerId: ME.id, followingId: 'u1' },
      });
      expect(notifications.notify).toHaveBeenCalledWith({
        type: 'FOLLOW',
        recipientId: 'u1',
        actorId: ME.id,
      });
    });

    it('takibi bırakınca bildirim göndermez', async () => {
      const { service, prisma, notifications } = setup();
      prisma.user.count.mockResolvedValue(1);
      prisma.follow.deleteMany.mockResolvedValue({ count: 1 });
      prisma.follow.count.mockResolvedValue(0);

      await expect(service.toggleFollow('u1', ME.id)).resolves.toEqual({
        following: false,
        followerCount: 0,
      });
      expect(notifications.notify).not.toHaveBeenCalled();
    });
  });
});
