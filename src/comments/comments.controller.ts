import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthUser } from '../auth/token-verifier.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CommentsService } from './comments.service.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';

@ApiTags('comments')
@Controller('posts/:id/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  list(@Param('id', ParseUUIDPipe) postId: string) {
    return this.comments.list(postId);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  create(
    @Param('id', ParseUUIDPipe) postId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.comments.create(postId, dto, user.id);
  }
}
