import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PostsService } from '../posts/posts.service.js';
import { UsersService } from '../users/users.service.js';
import { SearchQueryDto } from './dto/search-query.dto.js';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(
    private readonly posts: PostsService,
    private readonly users: UsersService,
  ) {}

  /**
   * Yazılarda başlık, içerik, yazar ve etiket; kullanıcılarda ad ve kullanıcı adı üzerinden arar.
   * Döner: sayfalı yazılar + (yalnızca ilk sayfada) en fazla 5 kullanıcı.
   */
  @Get()
  async search(@Query() query: SearchQueryDto) {
    const [posts, users] = await Promise.all([
      this.posts.search(query.q, query.page, query.limit),
      query.page === 1 ? this.users.search(query.q) : Promise.resolve([]),
    ]);
    return { query: query.q, ...posts, users };
  }
}
