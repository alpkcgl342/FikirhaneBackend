import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PostsService } from '../posts/posts.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { CommentsService } from './comments.service.js';

const POST_ID = '11111111-1111-1111-1111-111111111111';
const PARENT_ID = '22222222-2222-2222-2222-222222222222';

function setup() {
  const prisma = {
    comment: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  };
  const posts = { findPublishedOrThrow: vi.fn().mockResolvedValue({}) };
  const service = new CommentsService(
    prisma as unknown as PrismaService,
    posts as unknown as PostsService,
  );
  return { service, prisma, posts };
}

describe('CommentsService', () => {
  it('yayında olmayan yazıya yorum yapılamaz', async () => {
    const { service, prisma, posts } = setup();
    posts.findPublishedOrThrow.mockRejectedValue(new NotFoundException());

    await expect(
      service.create(POST_ID, { content: 'Merhaba' }, 'u1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.comment.create).not.toHaveBeenCalled();
  });

  it('başka bir yazının yorumuna yanıt verilemez', async () => {
    const { service, prisma } = setup();
    prisma.comment.findUnique.mockResolvedValue({ postId: 'baska-yazi' });

    await expect(
      service.create(POST_ID, { content: 'Yanıt', parentId: PARENT_ID }, 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.comment.create).not.toHaveBeenCalled();
  });

  it('yanıtı üst yoruma bağlar', async () => {
    const { service, prisma } = setup();
    prisma.comment.findUnique.mockResolvedValue({ postId: POST_ID });
    prisma.comment.create.mockResolvedValue({ id: 'c1' });

    await service.create(
      POST_ID,
      { content: 'Yanıt', parentId: PARENT_ID },
      'u1',
    );

    expect(prisma.comment.create.mock.calls[0][0].data).toEqual({
      content: 'Yanıt',
      post: { connect: { id: POST_ID } },
      author: { connect: { id: 'u1' } },
      parent: { connect: { id: PARENT_ID } },
    });
  });

  it('yorumları eskiden yeniye listeler', async () => {
    const { service, prisma } = setup();
    prisma.comment.findMany.mockResolvedValue([]);

    await expect(service.list(POST_ID)).resolves.toEqual({ items: [] });
    expect(prisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { postId: POST_ID },
        orderBy: { createdAt: 'asc' },
      }),
    );
  });
});
