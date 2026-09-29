import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/token-verifier.service.js';
import { containsInsensitive } from '../common/like.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  ReportStatus,
  ReportTargetType,
  Role,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

const PAGE_SIZE = 20;
const personSelect = { id: true, username: true, displayName: true };

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** Şikâyetler, hedef içeriğin kısa bir özetiyle (silinmişse `target: null`). */
  async listReports(status: ReportStatus, page: number) {
    const where = { status };
    const [total, reports] = await this.prisma.$transaction([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        orderBy: {
          createdAt: status === ReportStatus.PENDING ? 'asc' : 'desc',
        },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { reporter: { select: personSelect } },
      }),
    ]);

    const idsOf = (type: ReportTargetType) =>
      reports.filter((r) => r.targetType === type).map((r) => r.targetId);
    const [posts, comments, users] = await Promise.all([
      this.prisma.post.findMany({
        where: { id: { in: idsOf(ReportTargetType.POST) } },
        select: {
          id: true,
          slug: true,
          title: true,
          author: { select: personSelect },
        },
      }),
      this.prisma.comment.findMany({
        where: { id: { in: idsOf(ReportTargetType.COMMENT) } },
        select: {
          id: true,
          content: true,
          post: { select: { slug: true, title: true } },
          author: { select: personSelect },
        },
      }),
      this.prisma.user.findMany({
        where: { id: { in: idsOf(ReportTargetType.USER) } },
        select: { ...personSelect, role: true, isBanned: true },
      }),
    ]);
    const targets = new Map<string, unknown>(
      [...posts, ...comments, ...users].map((t) => [t.id, t]),
    );

    return {
      items: reports.map((r) => ({
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt,
        reporter: r.reporter,
        target: targets.get(r.targetId) ?? null,
      })),
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
    };
  }

  async resolveReport(id: string, status: ReportStatus) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!report) throw new NotFoundException('Şikâyet bulunamadı');
    return this.prisma.report.update({
      where: { id },
      data: { status },
      select: { id: true, status: true },
    });
  }

  /** Yazıyı kaldırır; ona ait bekleyen şikâyetler çözüldü sayılır. */
  async removePost(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!post) throw new NotFoundException('Yazı bulunamadı');
    await this.prisma.$transaction([
      this.prisma.post.delete({ where: { id } }),
      this.resolvePendingFor(ReportTargetType.POST, id),
    ]);
  }

  /** Yorumu (ve yanıtlarını) kaldırır; ona ait bekleyen şikâyetler çözüldü sayılır. */
  async removeComment(id: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!comment) throw new NotFoundException('Yorum bulunamadı');
    await this.prisma.$transaction([
      this.prisma.comment.delete({ where: { id } }),
      this.resolvePendingFor(ReportTargetType.COMMENT, id),
    ]);
  }

  /**
   * Engelleme kuralları: kimse kendini ve bir yöneticiyi (ADMIN) engelleyemez;
   * moderatörleri yalnızca yöneticiler engelleyebilir.
   */
  async setBan(actor: AuthUser, targetId: string, banned: boolean) {
    if (actor.id === targetId) {
      throw new BadRequestException('Kendinizi engelleyemezsiniz');
    }
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { role: true },
    });
    if (!target) throw new NotFoundException('Kullanıcı bulunamadı');
    if (target.role === Role.ADMIN) {
      throw new ForbiddenException('Yöneticiler engellenemez');
    }
    if (target.role === Role.MODERATOR && actor.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Moderatörleri yalnızca yöneticiler engelleyebilir',
      );
    }

    const operations: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.user.update({
        where: { id: targetId },
        data: { isBanned: banned },
      }),
    ];
    if (banned) {
      operations.push(this.resolvePendingFor(ReportTargetType.USER, targetId));
    }
    await this.prisma.$transaction(operations);
    return { id: targetId, isBanned: banned };
  }

  /** Yalnızca yöneticiler çağırabilir (controller'da @Roles(ADMIN)). */
  async setRole(actor: AuthUser, targetId: string, role: Role) {
    if (actor.id === targetId) {
      throw new BadRequestException('Kendi rolünüzü değiştiremezsiniz');
    }
    const exists = await this.prisma.user.count({ where: { id: targetId } });
    if (!exists) throw new NotFoundException('Kullanıcı bulunamadı');
    return this.prisma.user.update({
      where: { id: targetId },
      data: { role },
      select: { id: true, role: true },
    });
  }

  async listUsers(q: string | undefined, page: number) {
    const where: Prisma.UserWhereInput = q
      ? {
          OR: [
            { username: containsInsensitive(q) },
            { displayName: containsInsensitive(q) },
            { email: containsInsensitive(q) },
          ],
        }
      : {};
    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          ...personSelect,
          email: true,
          avatarUrl: true,
          role: true,
          isBanned: true,
          createdAt: true,
        },
      }),
    ]);
    return {
      items,
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
    };
  }

  private resolvePendingFor(targetType: ReportTargetType, targetId: string) {
    return this.prisma.report.updateMany({
      where: { targetType, targetId, status: ReportStatus.PENDING },
      data: { status: ReportStatus.RESOLVED },
    });
  }
}
