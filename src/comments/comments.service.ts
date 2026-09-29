import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { NotificationType } from '../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
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
  author: {
    select: { id: true, username: true, displayName: true, avatarUrl: true },
  },
} satisfies Prisma.CommentSelect;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostsService,
    private readonly notifications: NotificationsService,
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
    const post = await this.posts.findPublishedOrThrow(postId);

    let parentAuthorId: string | null = null;
    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
        select: { postId: true, authorId: true },
      });
      // Başka bir yazının yorumuna yanıt verilemez.
      if (!parent || parent.postId !== postId) {
        throw new BadRequestException('Yanıt verilen yorum bulunamadı');
      }
      parentAuthorId = parent.authorId;
    }

    const comment = await this.prisma.comment.create({
      data: {
        content: dto.content,
        post: { connect: { id: postId } },
        author: { connect: { id: authorId } },
        ...(dto.parentId && { parent: { connect: { id: dto.parentId } } }),
      },
      select: commentSelect,
    });

    // Yanıtlanan yorumun sahibine "yanıt", yazarına (farklı kişiyse) "yorum" bildirimi.
    const postRef = { id: post.id, slug: post.slug, title: post.title };
    const base = {
      type: NotificationType.COMMENT,
      actorId: authorId,
      post: postRef,
      commentId: comment.id,
    };
    if (parentAuthorId) {
      await this.notifications.notify({
        ...base,
        recipientId: parentAuthorId,
        reply: true,
      });
    }
    if (post.authorId !== parentAuthorId) {
      await this.notifications.notify({ ...base, recipientId: post.authorId });
    }

    return comment;
  }
}
