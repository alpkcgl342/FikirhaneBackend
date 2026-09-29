import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PostStatus,
  ReportStatus,
  ReportTargetType,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateReportDto } from './dto/create-report.dto.js';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateReportDto, reporterId: string) {
    const ownerId = await this.findTargetOwner(dto.targetType, dto.targetId);
    if (ownerId === reporterId) {
      throw new BadRequestException('Kendi içeriğinizi şikâyet edemezsiniz');
    }

    const pending = await this.prisma.report.count({
      where: {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        status: ReportStatus.PENDING,
      },
    });
    if (pending) {
      throw new ConflictException(
        'Bu içeriği zaten şikâyet ettiniz; inceleme sürüyor',
      );
    }

    return this.prisma.report.create({
      data: {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
      },
      select: { id: true, status: true, createdAt: true },
    });
  }

  /** Hedefin sahibini döner (kullanıcı şikâyetinde kullanıcının kendisi); yoksa 404. */
  private async findTargetOwner(
    type: ReportTargetType,
    id: string,
  ): Promise<string> {
    if (type === ReportTargetType.POST) {
      const post = await this.prisma.post.findUnique({
        where: { id },
        select: { authorId: true, status: true },
      });
      if (!post || post.status !== PostStatus.PUBLISHED) {
        throw new NotFoundException('Yazı bulunamadı');
      }
      return post.authorId;
    }
    if (type === ReportTargetType.COMMENT) {
      const comment = await this.prisma.comment.findUnique({
        where: { id },
        select: { authorId: true },
      });
      if (!comment) throw new NotFoundException('Yorum bulunamadı');
      return comment.authorId;
    }
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    return user.id;
  }
}
