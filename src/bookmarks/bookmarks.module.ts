import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PostsModule } from '../posts/posts.module.js';
import { BookmarksController } from './bookmarks.controller.js';

@Module({
  imports: [AuthModule, PostsModule],
  controllers: [BookmarksController],
})
export class BookmarksModule {}
