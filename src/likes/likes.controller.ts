import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthUser } from '../auth/token-verifier.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { toggleRelation } from '../common/toggle.js';
import { NotificationType } from '../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PostsService } from '../posts/posts.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('likes')
@Controller('posts')
export class LikesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Beğenir ya da beğeniyi kaldırır: `{ liked, likeCount }` */
  @Post(':id/like')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async toggle(
    @Param('id', ParseUUIDPipe) postId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const post = await this.posts.findPublishedOrThrow(postId);
    const where = { userId: user.id, postId };
    const liked = await toggleRelation(
      () => this.prisma.like.deleteMany({ where }),
      () => this.prisma.like.create({ data: where }),
    );
    if (liked) {
      await this.notifications.notify({
        type: NotificationType.LIKE,
        recipientId: post.authorId,
        actorId: user.id,
        post: { id: post.id, slug: post.slug, title: post.title },
      });
    }
    const likeCount = await this.prisma.like.count({ where: { postId } });
    return { liked, likeCount };
  }
}
