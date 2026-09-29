import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BookmarksModule } from './bookmarks/bookmarks.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { CommentsModule } from './comments/comments.module.js';
import { validateEnv } from './config/env.validation.js';
import { LikesModule } from './likes/likes.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PostsModule } from './posts/posts.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { SearchModule } from './search/search.module.js';
import { SupabaseModule } from './supabase/supabase.module.js';
import { UploadsModule } from './uploads/uploads.module.js';
import { UsersModule } from './users/users.module.js';

@Controller('health')
class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    SupabaseModule,
    AuthModule,
    CategoriesModule,
    PostsModule,
    UploadsModule,
    CommentsModule,
    LikesModule,
    BookmarksModule,
    UsersModule,
    SearchModule,
    NotificationsModule,
    ReportsModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
