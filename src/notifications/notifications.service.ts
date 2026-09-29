import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { NotificationType } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface NotifyInput {
  type: NotificationType;
  recipientId: string;
  actorId: string;
  post?: { id: string; slug: string; title: string };
  commentId?: string;
  /** COMMENT: true ise yorumuna yanıt verildi, değilse yazına yorum yapıldı. */
  reply?: boolean;
}

const PAGE_SIZE = 20;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Bildirim oluşturur. Kişi kendi işlemi için bildirim almaz; beğeni ve takip
   * bildirimleri aynı kişi ve hedef için tekrarlanmaz (beğen-geri al-beğen).
   * Bildirim hatası asıl işlemi (yorum, beğeni…) bozmamalı; hata yalnızca loglanır.
   */
  async notify(input: NotifyInput): Promise<void> {
    if (input.recipientId === input.actorId) return;
    try {
      if (input.type !== NotificationType.COMMENT) {
        const filters: Prisma.NotificationWhereInput[] = [
          { data: { path: ['actor', 'id'], equals: input.actorId } },
        ];
        if (input.post) {
          filters.push({
            data: { path: ['post', 'id'], equals: input.post.id },
          });
        }
        const existing = await this.prisma.notification.count({
          where: { userId: input.recipientId, type: input.type, AND: filters },
        });
        if (existing) return;
      }

      const actor = await this.prisma.user.findUnique({
        where: { id: input.actorId },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      });
      if (!actor) return;

      const data: Prisma.InputJsonObject = {
        actor,
        ...(input.post && { post: input.post }),
        ...(input.commentId && { commentId: input.commentId }),
        ...(input.reply && { reply: true }),
      };
      await this.prisma.notification.create({
        data: { userId: input.recipientId, type: input.type, data },
      });
    } catch (error) {
      this.logger.error(`Bildirim oluşturulamadı: ${String(error)}`);
    }
  }

  async list(userId: string, page: number) {
    const where = { userId };
    const [total, unreadCount, items] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          type: true,
          data: true,
          isRead: true,
          createdAt: true,
        },
      }),
    ]);
    return {
      items,
      unreadCount,
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
    };
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { unreadCount: count };
  }

  async markAllRead(userId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { updated: count };
  }
}
