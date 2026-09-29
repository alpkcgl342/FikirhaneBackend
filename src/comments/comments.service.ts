import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PostsService } from '../posts/posts.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateCommentDto } from './dto/create-comment.dto.js';

/** Bir yazıda döndürülecek en fazla yorum (ödev ölçeğinde sayfalama gerekmez). */
const MAX_COMMENTS = 500;

const commentSelect = {
  id: true,
  parentId: true,
  content: true,
  createdAt: true,
  author: { select: { username: true, displayName: true, avatarUrl: true } },
} satisfies Prisma.CommentSelect;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostsService,
  ) {}

  /** Yorumlar eskiden yeniye, düz liste olarak döner; ağaç `parentId` ile kurulur. */
  async list(postId: string) {
    await this.posts.findPublishedOrThrow(postId);
    const items = await this.prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
      take: MAX_COMMENTS,
      select: commentSelect,
    });
    return { items };
  }

  async create(postId: string, dto: CreateCommentDto, authorId: string) {
    await this.posts.findPublishedOrThrow(postId);

    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
        select: { postId: true },
      });
      // Başka bir yazının yorumuna yanıt verilemez.
      if (!parent || parent.postId !== postId) {
        throw new BadRequestException('Yanıt verilen yorum bulunamadı');
      }
    }

    return this.prisma.comment.create({
      data: {
        content: dto.content,
        post: { connect: { id: postId } },
        author: { connect: { id: authorId } },
        ...(dto.parentId && { parent: { connect: { id: dto.parentId } } }),
      },
      select: commentSelect,
    });
  }
}
