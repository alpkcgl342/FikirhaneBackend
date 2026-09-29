import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/token-verifier.service.js';
import { containsInsensitive } from '../common/like.js';
import { isOwnImageUrl } from '../common/storage.js';
import { Prisma } from '../generated/prisma/client.js';
import { PostStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { CreatePostDto } from './dto/create-post.dto.js';
import type { ListPostsQueryDto } from './dto/list-posts-query.dto.js';
import type { UpdatePostDto } from './dto/update-post.dto.js';
import {
  excerpt,
  normalizeTags,
  readingTime,
  uniqueSlug,
} from './post-text.util.js';

const postInclude = {
  author: { select: { username: true, displayName: true, avatarUrl: true } },
  category: { select: { id: true, name: true, slug: true } },
  tags: { select: { tag: { select: { name: true } } } },
  _count: { select: { likes: true, comments: true } },
} satisfies Prisma.PostInclude;

type PostWithRelations = Prisma.PostGetPayload<{ include: typeof postInclude }>;

@Injectable()
export class PostsService {
  private readonly supabaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    supabase: SupabaseService,
  ) {
    this.supabaseUrl = supabase.projectUrl;
  }

  async list(query: ListPostsQueryDto, viewer?: AuthUser) {
    const where: Prisma.PostWhereInput = {};

    if (query.status === 'PUBLISHED') {
      where.status = PostStatus.PUBLISHED;
      const author: Prisma.UserWhereInput = {};
      if (query.author) author.username = query.author;
      if (query.following) {
        if (!viewer) {
          throw new UnauthorizedException(
            'Takip ettiklerinin yazılarını görmek için giriş yapın',
          );
        }
        author.followers = { some: { followerId: viewer.id } };
      }
      if (Object.keys(author).length) where.author = author;
    } else {
      // Taslaklar yalnızca yazarına gösterilir: DRAFT/ALL her zaman kendi yazılarıdır.
      if (!viewer) {
        throw new UnauthorizedException('Taslakları görmek için giriş yapın');
      }
      where.authorId = viewer.id;
      if (query.status === 'DRAFT') where.status = PostStatus.DRAFT;
    }
    if (query.bookmarked) {
      if (!viewer) {
        throw new UnauthorizedException(
          'Kaydedilen yazıları görmek için giriş yapın',
        );
      }
      where.bookmarks = { some: { userId: viewer.id } };
    }
    if (query.category) where.category = { slug: query.category };
    if (query.tag) {
      where.tags = {
        some: { tag: { name: query.tag.toLocaleLowerCase('tr') } },
      };
    }

    let orderBy: Prisma.PostOrderByWithRelationInput[];
    if (query.status !== 'PUBLISHED') {
      orderBy = [{ updatedAt: 'desc' }];
    } else if (query.sort === 'popular') {
      // Popüler: önce beğeni, eşitlikte yorum sayısı, sonra yenilik.
      orderBy = [
        { likes: { _count: 'desc' } },
        { comments: { _count: 'desc' } },
        { createdAt: 'desc' },
      ];
    } else {
      orderBy = [{ createdAt: 'desc' }];
    }

    return this.paginate(where, orderBy, query.page, query.limit);
  }

  /** Yayındaki yazılarda başlık, içerik, yazar ve etiket üzerinden arama (büyük/küçük harf duyarsız). */
  search(q: string, page: number, limit: number) {
    const term = containsInsensitive(q);
    const where: Prisma.PostWhereInput = {
      status: PostStatus.PUBLISHED,
      OR: [
        { title: term },
        { content: term },
        { author: { displayName: term } },
        { author: { username: term } },
        { tags: { some: { tag: { name: term } } } },
      ],
    };
    return this.paginate(where, [{ createdAt: 'desc' }], page, limit);
  }

  private async paginate(
    where: Prisma.PostWhereInput,
    orderBy: Prisma.PostOrderByWithRelationInput[],
    page: number,
    limit: number,
  ) {
    const [total, posts] = await this.prisma.$transaction([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        orderBy,
        include: postInclude,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: posts.map(toPostSummary),
      page,
      pageSize: limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getBySlug(slug: string, viewer?: AuthUser) {
    const post = await this.prisma.post.findUnique({
      where: { slug },
      include: postInclude,
    });
    // Başkasının taslağı hiç yokmuş gibi davranılır.
    if (
      !post ||
      (post.status === PostStatus.DRAFT && post.authorId !== viewer?.id)
    ) {
      throw new NotFoundException('Yazı bulunamadı');
    }

    let likedByMe = false;
    let bookmarkedByMe = false;
    if (viewer) {
      const key = { userId_postId: { userId: viewer.id, postId: post.id } };
      const [like, bookmark] = await Promise.all([
        this.prisma.like.findUnique({ where: key, select: { userId: true } }),
        this.prisma.bookmark.findUnique({
          where: key,
          select: { userId: true },
        }),
      ]);
      likedByMe = Boolean(like);
      bookmarkedByMe = Boolean(bookmark);
    }
    return { ...toPostDetail(post, viewer), likedByMe, bookmarkedByMe };
  }

  /**
   * Beğeni, kaydetme ve yorum yalnızca yayındaki yazılar için yapılabilir;
   * taslaklar (yazarı dahil) bu işlemlerde yokmuş gibi davranır.
   */
  async findPublishedOrThrow(postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        authorId: true,
        status: true,
        slug: true,
        title: true,
      },
    });
    if (!post || post.status !== PostStatus.PUBLISHED) {
      throw new NotFoundException('Yazı bulunamadı');
    }
    return post;
  }

  async create(dto: CreatePostDto, authorId: string) {
    await this.assertCategoryExists(dto.categoryId);
    this.assertCoverUrl(dto.coverUrl);
    const tags = normalizeTags(dto.tags ?? []);

    // Slug'daki rastgele ek çakışmayı çok olasılık dışı kılar; yine de birkaç kez denenir.
    for (let attempt = 0; ; attempt++) {
      try {
        const post = await this.prisma.post.create({
          data: {
            title: dto.title,
            slug: uniqueSlug(dto.title),
            content: dto.content,
            readingTime: readingTime(dto.content),
            coverUrl: dto.coverUrl ?? null,
            status: dto.status ?? PostStatus.DRAFT,
            author: { connect: { id: authorId } },
            ...(dto.categoryId && {
              category: { connect: { id: dto.categoryId } },
            }),
            tags: { create: tags.map(tagLink) },
          },
          include: postInclude,
        });
        return toPostDetail(post, { id: authorId, email: '' });
      } catch (e) {
        // posts tablosundaki tek benzersiz alan slug'dır.
        const slugTaken =
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002';
        if (!slugTaken || attempt >= 2) throw e;
      }
    }
  }

  async update(id: string, dto: UpdatePostDto, userId: string) {
    await this.assertAuthor(id, userId);
    await this.assertCategoryExists(dto.categoryId);
    this.assertCoverUrl(dto.coverUrl);

    const data: Prisma.PostUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.content !== undefined) {
      data.content = dto.content;
      data.readingTime = readingTime(dto.content);
    }
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.coverUrl !== undefined) data.coverUrl = dto.coverUrl;
    if (dto.categoryId !== undefined) {
      data.category = dto.categoryId
        ? { connect: { id: dto.categoryId } }
        : { disconnect: true };
    }
    if (dto.tags !== undefined) {
      data.tags = {
        deleteMany: {},
        create: normalizeTags(dto.tags).map(tagLink),
      };
    }

    const post = await this.prisma.post.update({
      where: { id },
      data,
      include: postInclude,
    });
    return toPostDetail(post, { id: userId, email: '' });
  }

  async remove(id: string, userId: string) {
    await this.assertAuthor(id, userId);
    await this.prisma.post.delete({ where: { id } });
  }

  private async assertAuthor(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });
    if (!post) throw new NotFoundException('Yazı bulunamadı');
    if (post.authorId !== userId) {
      throw new ForbiddenException('Bu yazı üzerinde işlem yetkiniz yok');
    }
  }

  private async assertCategoryExists(categoryId: string | null | undefined) {
    if (!categoryId) return;
    const exists = await this.prisma.category.count({
      where: { id: categoryId },
    });
    if (!exists) throw new BadRequestException('Kategori bulunamadı');
  }

  private assertCoverUrl(coverUrl: string | null | undefined) {
    if (coverUrl && !isOwnImageUrl(coverUrl, this.supabaseUrl)) {
      throw new BadRequestException(
        'Kapak görseli Fikirhane üzerinden yüklenmelidir',
      );
    }
  }
}

function tagLink(name: string) {
  return {
    tag: { connectOrCreate: { where: { name }, create: { name } } },
  };
}

function toPostSummary(post: PostWithRelations) {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: excerpt(post.content),
    coverUrl: post.coverUrl,
    status: post.status,
    readingTime: post.readingTime,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: post.author,
    category: post.category,
    tags: post.tags.map((t) => t.tag.name),
    likeCount: post._count.likes,
    commentCount: post._count.comments,
  };
}

function toPostDetail(post: PostWithRelations, viewer?: AuthUser) {
  const { excerpt: _excerpt, ...summary } = toPostSummary(post);
  return {
    ...summary,
    content: post.content,
    isOwner: viewer?.id === post.authorId,
  };
}
