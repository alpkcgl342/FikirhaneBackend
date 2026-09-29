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
import { PostsService } from '../posts/posts.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('bookmarks')
@Controller('posts')
export class BookmarksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostsService,
  ) {}

  /** Kaydeder ya da kaydı kaldırır: `{ bookmarked }`. Liste: `GET /posts?bookmarked=true` */
  @Post(':id/bookmark')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async toggle(
    @Param('id', ParseUUIDPipe) postId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.posts.findPublishedOrThrow(postId);
    const where = { userId: user.id, postId };
    const bookmarked = await toggleRelation(
      () => this.prisma.bookmark.deleteMany({ where }),
      () => this.prisma.bookmark.create({ data: where }),
    );
    return { bookmarked };
  }
}
