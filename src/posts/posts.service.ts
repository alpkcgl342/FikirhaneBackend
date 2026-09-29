import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PostStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { AuthUser } from '../auth/token-verifier.service.js';
import type { CreatePostDto } from './dto/create-post.dto.js';
import type { ListPostsQueryDto } from './dto/list-posts-query.dto.js';
import type { UpdatePostDto } from './dto/update-post.dto.js';
import {
  excerpt,
  normalizeTags,
  readingTime,
  uniqueSlug,
} from './post-text.util.js';

export const POST_IMAGES_BUCKET = 'post-images';

const postInclude = {
  author: { select: { username: true, displayName: true, avatarUrl: true } },
  category: { select: { id: true, name: true, slug: true } },
  tags: { select: { tag: { select: { name: true } } } },
} satisfies Prisma.PostInclude;

type PostWithRelations = Prisma.PostGetPayload<{ include: typeof postInclude }>;

@Injectable()
export class PostsService {
  private readonly coverUrlPrefix: string;

  constructor(
    private readonly prisma: PrismaService,
    supabase: SupabaseService,
  ) {
    this.coverUrlPrefix = `${supabase.projectUrl}/storage/v1/object/public/${POST_IMAGES_BUCKET}/`;
  }

  async list(query: ListPostsQueryDto, viewer?: AuthUser) {
    const where: Prisma.PostWhereInput = {};

    if (query.status === 'PUBLISHED') {
      where.status = PostStatus.PUBLISHED;
      if (query.author) where.author = { username: query.author };
    } else {
      // Taslaklar yalnızca yazarına gösterilir: DRAFT/ALL her zaman kendi yazılarıdır.
      if (!viewer) {
        throw new UnauthorizedException('Taslakları görmek için giriş yapın');
      }
      where.authorId = viewer.id;
      if (query.status === 'DRAFT') where.status = PostStatus.DRAFT;
    }
    if (query.category) where.category = { slug: query.category };
    if (query.tag) {
      where.tags = {
        some: { tag: { name: query.tag.toLocaleLowerCase('tr') } },
      };
    }

    const orderBy: Prisma.PostOrderByWithRelationInput =
      query.status === 'PUBLISHED'
        ? { createdAt: 'desc' }
        : { updatedAt: 'desc' };

    const [total, posts] = await this.prisma.$transaction([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        orderBy,
        include: postInclude,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      items: posts.map(toPostSummary),
      page: query.page,
      pageSize: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
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
    return toPostDetail(post, viewer);
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

  /** Kapak görseli yalnızca projenin kendi Storage kovasından olabilir. */
  private assertCoverUrl(coverUrl: string | null | undefined) {
    if (coverUrl && !coverUrl.startsWith(this.coverUrlPrefix)) {
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
