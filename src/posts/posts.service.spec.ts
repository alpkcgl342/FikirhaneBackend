import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { SupabaseService } from '../supabase/supabase.service.js';
import { ListPostsQueryDto } from './dto/list-posts-query.dto.js';
import { PostsService } from './posts.service.js';

const AUTHOR = { id: 'author-id', email: 'a@example.com' };
const OTHER = { id: 'other-id', email: 'o@example.com' };
const SUPABASE_URL = 'https://proje.supabase.co';
const COVER = `${SUPABASE_URL}/storage/v1/object/public/post-images/author-id/x.jpg`;

function dbPost(overrides: Record<string, unknown> = {}) {
  return {
    id: 'post-id',
    slug: 'merhaba-abc123',
    title: 'Merhaba',
    content: '**Merhaba** dünya',
    coverUrl: null,
    status: 'PUBLISHED',
    readingTime: 1,
    authorId: AUTHOR.id,
    categoryId: null,
    createdAt: new Date('2026-09-29T00:00:00Z'),
    updatedAt: new Date('2026-09-29T00:00:00Z'),
    author: { username: 'ayse', displayName: 'Ayşe', avatarUrl: null },
    category: null,
    tags: [{ tag: { name: 'deneme' } }],
    _count: { likes: 3, comments: 2 },
    ...overrides,
  };
}

function setup() {
  const prisma = {
    post: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    category: { count: vi.fn() },
    like: { findUnique: vi.fn().mockResolvedValue(null) },
    bookmark: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
  };
  const service = new PostsService(
    prisma as unknown as PrismaService,
    { projectUrl: SUPABASE_URL } as unknown as SupabaseService,
  );
  return { service, prisma };
}

function query(overrides: Partial<ListPostsQueryDto> = {}) {
  return Object.assign(new ListPostsQueryDto(), overrides);
}

describe('PostsService', () => {
  describe('list', () => {
    it('varsayılan olarak yalnızca yayınlanmış yazıları, özetle döner', async () => {
      const { service, prisma } = setup();
      prisma.post.count.mockResolvedValue(1);
      prisma.post.findMany.mockResolvedValue([dbPost()]);

      const result = await service.list(query({ author: 'ayse', tag: 'Işık' }));

      expect(prisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'PUBLISHED',
            author: { username: 'ayse' },
            tags: { some: { tag: { name: 'ışık' } } },
          },
          skip: 0,
          take: 10,
        }),
      );
      expect(result.items[0]).toMatchObject({
        excerpt: 'Merhaba dünya',
        tags: ['deneme'],
      });
      expect(result.items[0]).not.toHaveProperty('content');
      expect(result.totalPages).toBe(1);
    });

    it('taslak listesi giriş yapmadan istenirse 401 döner', async () => {
      const { service } = setup();
      await expect(
        service.list(query({ status: 'DRAFT' })),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('taslak listesi her zaman isteyenin kendi yazılarıyla sınırlanır', async () => {
      const { service, prisma } = setup();
      prisma.post.count.mockResolvedValue(0);
      prisma.post.findMany.mockResolvedValue([]);

      await service.list(query({ status: 'DRAFT', author: 'baskasi' }), OTHER);

      expect(prisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { authorId: OTHER.id, status: 'DRAFT' },
        }),
      );
    });
  });

  describe('getBySlug', () => {
    it('başkasının taslağı için 404 döner', async () => {
      const { service, prisma } = setup();
      prisma.post.findUnique.mockResolvedValue(dbPost({ status: 'DRAFT' }));

      await expect(service.getBySlug('x', OTHER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.getBySlug('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('yazar kendi taslağını görür ve isOwner true olur', async () => {
      const { service, prisma } = setup();
      prisma.post.findUnique.mockResolvedValue(dbPost({ status: 'DRAFT' }));

      const post = await service.getBySlug('x', AUTHOR);

      expect(post.isOwner).toBe(true);
      expect(post.content).toBe('**Merhaba** dünya');
    });

    it('beğeni/yorum sayılarını ve izleyicinin beğenip kaydettiğini döner', async () => {
      const { service, prisma } = setup();
      prisma.post.findUnique.mockResolvedValue(dbPost());
      prisma.like.findUnique.mockResolvedValue({ userId: OTHER.id });

      const post = await service.getBySlug('x', OTHER);

      expect(post).toMatchObject({
        likeCount: 3,
        commentCount: 2,
        likedByMe: true,
        bookmarkedByMe: false,
        isOwner: false,
      });
      expect(prisma.like.findUnique).toHaveBeenCalledWith({
        where: { userId_postId: { userId: OTHER.id, postId: 'post-id' } },
        select: { userId: true },
      });
    });

    it('anonim izleyici için beğeni sorgusu yapılmaz', async () => {
      const { service, prisma } = setup();
      prisma.post.findUnique.mockResolvedValue(dbPost());

      const post = await service.getBySlug('x');

      expect(post.likedByMe).toBe(false);
      expect(prisma.like.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('findPublishedOrThrow', () => {
    it.each([null, { id: 'p', authorId: AUTHOR.id, status: 'DRAFT' }])(
      'yok ya da taslak (%o) ise 404 döner',
      async (post) => {
        const { service, prisma } = setup();
        prisma.post.findUnique.mockResolvedValue(post);

        await expect(service.findPublishedOrThrow('p')).rejects.toBeInstanceOf(
          NotFoundException,
        );
      },
    );
  });

  describe('list (akış)', () => {
    it('popüler sıralama beğeni, yorum ve yeniliğe göredir', async () => {
      const { service, prisma } = setup();
      prisma.post.count.mockResolvedValue(0);
      prisma.post.findMany.mockResolvedValue([]);

      await service.list(query({ sort: 'popular' }));

      expect(prisma.post.findMany.mock.calls[0][0].orderBy).toEqual([
        { likes: { _count: 'desc' } },
        { comments: { _count: 'desc' } },
        { createdAt: 'desc' },
      ]);
    });

    it('takip akışı giriş gerektirir', async () => {
      const { service } = setup();
      await expect(
        service.list(query({ following: true })),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('takip akışı yazar filtresiyle birleşir', async () => {
      const { service, prisma } = setup();
      prisma.post.count.mockResolvedValue(0);
      prisma.post.findMany.mockResolvedValue([]);

      await service.list(query({ following: true, author: 'ayse' }), OTHER);

      expect(prisma.post.findMany.mock.calls[0][0].where).toEqual({
        status: 'PUBLISHED',
        author: {
          username: 'ayse',
          followers: { some: { followerId: OTHER.id } },
        },
      });
    });
  });

  describe('search', () => {
    it('yayındaki yazılarda joker karakterleri kaçışlanmış terimle arar', async () => {
      const { service, prisma } = setup();
      prisma.post.count.mockResolvedValue(0);
      prisma.post.findMany.mockResolvedValue([]);

      await service.search('50%_', 2, 5);

      const args = prisma.post.findMany.mock.calls[0][0];
      const term = { contains: '50\\%\\_', mode: 'insensitive' };
      expect(args.where).toEqual({
        status: 'PUBLISHED',
        OR: [
          { title: term },
          { content: term },
          { author: { displayName: term } },
          { author: { username: term } },
          { tags: { some: { tag: { name: term } } } },
        ],
      });
      expect(args.skip).toBe(5);
      expect(args.take).toBe(5);
    });
  });

  describe('list (kaydedilenler)', () => {
    it('giriş yapmadan kaydedilenler istenirse 401 döner', async () => {
      const { service } = setup();
      await expect(
        service.list(query({ bookmarked: true })),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('yalnızca izleyicinin kaydettiği yayındaki yazıları döner', async () => {
      const { service, prisma } = setup();
      prisma.post.count.mockResolvedValue(0);
      prisma.post.findMany.mockResolvedValue([]);

      await service.list(query({ bookmarked: true }), OTHER);

      expect(prisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'PUBLISHED',
            bookmarks: { some: { userId: OTHER.id } },
          },
        }),
      );
    });
  });

  describe('create', () => {
    it('slug, okuma süresi ve etiketleri üretir; varsayılan durum taslaktır', async () => {
      const { service, prisma } = setup();
      prisma.post.create.mockResolvedValue(dbPost());

      await service.create(
        {
          title: 'Merhaba Dünya',
          content: 'kelime',
          tags: ['Deneme', 'deneme'],
        },
        AUTHOR.id,
      );

      const data = prisma.post.create.mock.calls[0][0].data;
      expect(data.slug).toMatch(/^merhaba-dunya-[0-9a-f]{6}$/);
      expect(data.readingTime).toBe(1);
      expect(data.status).toBe('DRAFT');
      expect(data.tags.create).toHaveLength(1);
    });

    it('başka bir sitedeki kapak görselini reddeder', async () => {
      const { service, prisma } = setup();

      await expect(
        service.create(
          {
            title: 'Başlık',
            content: 'x',
            coverUrl: 'https://kotu.site/x.jpg',
          },
          AUTHOR.id,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.post.create).not.toHaveBeenCalled();
    });

    it('kendi Storage kovasındaki kapak görselini kabul eder', async () => {
      const { service, prisma } = setup();
      prisma.post.create.mockResolvedValue(dbPost({ coverUrl: COVER }));

      await service.create(
        { title: 'Başlık', content: 'x', coverUrl: COVER },
        AUTHOR.id,
      );

      expect(prisma.post.create.mock.calls[0][0].data.coverUrl).toBe(COVER);
    });

    it('olmayan kategori için 400 döner', async () => {
      const { service, prisma } = setup();
      prisma.category.count.mockResolvedValue(0);

      await expect(
        service.create(
          {
            title: 'Başlık',
            content: 'x',
            categoryId: '00000000-0000-0000-0000-000000000000',
          },
          AUTHOR.id,
        ),
      ).rejects.toThrow('Kategori bulunamadı');
    });
  });

  describe('update / remove', () => {
    it('yazar olmayan kullanıcı güncelleyemez ve silemez', async () => {
      const { service, prisma } = setup();
      prisma.post.findUnique.mockResolvedValue({ authorId: AUTHOR.id });

      await expect(
        service.update('post-id', { title: 'Yeni' }, OTHER.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.remove('post-id', OTHER.id)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.post.update).not.toHaveBeenCalled();
      expect(prisma.post.delete).not.toHaveBeenCalled();
    });

    it('olmayan yazı için 404 döner', async () => {
      const { service, prisma } = setup();
      prisma.post.findUnique.mockResolvedValue(null);

      await expect(service.remove('yok', AUTHOR.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('yalnızca gönderilen alanları günceller; içerik değişince okuma süresini yeniler', async () => {
      const { service, prisma } = setup();
      prisma.post.findUnique.mockResolvedValue({ authorId: AUTHOR.id });
      prisma.post.update.mockResolvedValue(dbPost());

      await service.update(
        'post-id',
        { content: 'kelime '.repeat(401), categoryId: null, tags: ['Yeni'] },
        AUTHOR.id,
      );

      expect(prisma.post.update.mock.calls[0][0].data).toEqual({
        content: 'kelime '.repeat(401),
        readingTime: 3,
        category: { disconnect: true },
        tags: {
          deleteMany: {},
          create: [
            {
              tag: {
                connectOrCreate: {
                  where: { name: 'yeni' },
                  create: { name: 'yeni' },
                },
              },
            },
          ],
        },
      });
    });
  });
});
