import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PostsModule } from '../posts/posts.module.js';
import { CommentsController } from './comments.controller.js';
import { CommentsService } from './comments.service.js';

@Module({
  imports: [AuthModule, PostsModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
