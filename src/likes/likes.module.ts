import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PostsModule } from '../posts/posts.module.js';
import { LikesController } from './likes.controller.js';

@Module({
  imports: [AuthModule, PostsModule],
  controllers: [LikesController],
})
export class LikesModule {}
