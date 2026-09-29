import { Module } from '@nestjs/common';
import { PostsModule } from '../posts/posts.module.js';
import { UsersModule } from '../users/users.module.js';
import { SearchController } from './search.controller.js';

@Module({
  imports: [PostsModule, UsersModule],
  controllers: [SearchController],
})
export class SearchModule {}
