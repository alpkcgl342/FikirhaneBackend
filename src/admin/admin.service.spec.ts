import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AdminService } from './admin.service.js';

const ADMIN = { id: 'admin', email: '', role: 'ADMIN' as const };
const MOD = { id: 'mod', email: '', role: 'MODERATOR' as const };

function setup() {
  const prisma = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn().mockReturnValue('user.update'),
      count: vi.fn(),
    },
    post: {
      findUnique: vi.fn(),
      delete: vi.fn().mockReturnValue('post.delete'),
    },
    comment: {
      findUnique: vi.fn(),
      delete: vi.fn().mockReturnValue('comment.delete'),
    },
    report: {
      updateMany: vi.fn().mockReturnValue('report.updateMany'),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn().mockResolvedValue([]),
  };
  const service = new AdminService(prisma as unknown as PrismaService);
  return { service, prisma };
}

describe('AdminService', () => {
  describe('setBan', () => {
    it('kendini engelleyemez', async () => {
      const { service } = setup();
      await expect(service.setBan(MOD, MOD.id, true)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('yönetici engellenemez', async () => {
      const { service, prisma } = setup();
      prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });

      await expect(service.setBan(ADMIN, 'x', true)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('moderatörü yalnızca yönetici engelleyebilir', async () => {
      const { service, prisma } = setup();
      prisma.user.findUnique.mockResolvedValue({ role: 'MODERATOR' });

      await expect(service.setBan(MOD, 'x', true)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.setBan(ADMIN, 'x', true)).resolves.toEqual({
        id: 'x',
        isBanned: true,
      });
    });

    it('engellerken bekleyen kullanıcı şikâyetlerini çözer, kaldırırken dokunmaz', async () => {
      const { service, prisma } = setup();
      prisma.user.findUnique.mockResolvedValue({ role: 'USER' });

      await service.setBan(MOD, 'u1', true);
      expect(prisma.$transaction.mock.calls[0][0]).toEqual([
        'user.update',
        'report.updateMany',
      ]);
      expect(prisma.report.updateMany).toHaveBeenCalledWith({
        where: { targetType: 'USER', targetId: 'u1', status: 'PENDING' },
        data: { status: 'RESOLVED' },
      });

      await service.setBan(MOD, 'u1', false);
      expect(prisma.$transaction.mock.calls[1][0]).toEqual(['user.update']);
    });
  });

  describe('içerik kaldırma', () => {
    it('yazıyı siler ve bekleyen şikâyetlerini çözer', async () => {
      const { service, prisma } = setup();
      prisma.post.findUnique.mockResolvedValue({ id: 'p1' });

      await service.removePost('p1');

      expect(prisma.$transaction.mock.calls[0][0]).toEqual([
        'post.delete',
        'report.updateMany',
      ]);
      expect(prisma.report.updateMany).toHaveBeenCalledWith({
        where: { targetType: 'POST', targetId: 'p1', status: 'PENDING' },
        data: { status: 'RESOLVED' },
      });
    });

    it('olmayan yorum için 404 döner', async () => {
      const { service, prisma } = setup();
      prisma.comment.findUnique.mockResolvedValue(null);

      await expect(service.removeComment('yok')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  it('kendi rolünü değiştiremez', async () => {
    const { service } = setup();
    await expect(
      service.setRole(ADMIN, ADMIN.id, 'USER'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
