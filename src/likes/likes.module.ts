import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PostsModule } from '../posts/posts.module.js';
import { LikesController } from './likes.controller.js';

@Module({
  imports: [AuthModule, PostsModule, NotificationsModule],
  controllers: [LikesController],
})
export class LikesModule {}
