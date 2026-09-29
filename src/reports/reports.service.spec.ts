import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ReportsService } from './reports.service.js';

const TARGET = '11111111-1111-1111-1111-111111111111';

function setup() {
  const prisma = {
    post: { findUnique: vi.fn() },
    comment: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    report: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'r1', status: 'PENDING' }),
    },
  };
  const service = new ReportsService(prisma as unknown as PrismaService);
  return { service, prisma };
}

const dto = (targetType: 'POST' | 'COMMENT' | 'USER') => ({
  targetType,
  targetId: TARGET,
  reason: 'Hakaret içeriyor',
});

describe('ReportsService', () => {
  it('yayındaki başkasının yazısını şikâyet eder', async () => {
    const { service, prisma } = setup();
    prisma.post.findUnique.mockResolvedValue({
      authorId: 'yazar',
      status: 'PUBLISHED',
    });

    await service.create(dto('POST'), 'raportor');

    expect(prisma.report.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          reporterId: 'raportor',
          targetType: 'POST',
          targetId: TARGET,
          reason: 'Hakaret içeriyor',
        },
      }),
    );
  });

  it('taslak yazı şikâyet edilemez (404)', async () => {
    const { service, prisma } = setup();
    prisma.post.findUnique.mockResolvedValue({
      authorId: 'yazar',
      status: 'DRAFT',
    });

    await expect(
      service.create(dto('POST'), 'raportor'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('kendi yorumunu ya da kendini şikâyet edemez', async () => {
    const { service, prisma } = setup();
    prisma.comment.findUnique.mockResolvedValue({ authorId: 'ben' });
    prisma.user.findUnique.mockResolvedValue({ id: 'ben' });

    await expect(service.create(dto('COMMENT'), 'ben')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.create(dto('USER'), 'ben')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('aynı hedef için bekleyen şikâyet varken tekrar şikâyet edilemez', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue({ id: 'baskasi' });
    prisma.report.count.mockResolvedValue(1);

    await expect(
      service.create(dto('USER'), 'raportor'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.report.create).not.toHaveBeenCalled();
  });
});
