import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { toPublicUser } from '../auth/auth.service.js';
import type { AuthUser } from '../auth/token-verifier.service.js';
import { containsInsensitive } from '../common/like.js';
import { isOwnImageUrl } from '../common/storage.js';
import { toggleRelation } from '../common/toggle.js';
import type { Prisma } from '../generated/prisma/client.js';
import { NotificationType, PostStatus } from '../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';

@Injectable()
export class UsersService {
  private readonly supabaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    supabase: SupabaseService,
    private readonly notifications: NotificationsService,
  ) {
    this.supabaseUrl = supabase.projectUrl;
  }

  /** Herkese açık profil; e-posta ve rol gibi özel bilgiler dönmez. */
  async getProfile(username: string, viewer?: AuthUser) {
    const user = await this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        isBanned: true,
        createdAt: true,
        _count: {
          select: {
            posts: { where: { status: PostStatus.PUBLISHED } },
            followers: true,
            following: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');

    const isMe = viewer?.id === user.id;
    let isFollowing = false;
    if (viewer && !isMe) {
      const follow = await this.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: viewer.id,
            followingId: user.id,
          },
        },
        select: { followerId: true },
      });
      isFollowing = Boolean(follow);
    }

    const { _count, ...profile } = user;
    return {
      ...profile,
      postCount: _count.posts,
      followerCount: _count.followers,
      followingCount: _count.following,
      isMe,
      isFollowing,
    };
  }

  /** Ad veya kullanıcı adında geçen en fazla 5 kullanıcı (en çok takipçisi olan önce). */
  search(q: string) {
    const term = containsInsensitive(q);
    return this.prisma.user.findMany({
      where: { OR: [{ displayName: term }, { username: term }] },
      orderBy: [{ followers: { _count: 'desc' } }, { username: 'asc' }],
      take: 5,
      select: {
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
      },
    });
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    if (dto.avatarUrl && !isOwnImageUrl(dto.avatarUrl, this.supabaseUrl)) {
      throw new BadRequestException(
        'Profil fotoğrafı Fikirhane üzerinden yüklenmelidir',
      );
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    // Boş biyografi kaydedilmez, alan temizlenir.
    if (dto.bio !== undefined) data.bio = dto.bio || null;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;

    const user = await this.prisma.user.update({ where: { id: userId }, data });
    return { user: toPublicUser(user) };
  }

  /** Takip eder ya da takibi bırakır: `{ following, followerCount }` */
  async toggleFollow(targetId: string, followerId: string) {
    if (targetId === followerId) {
      throw new BadRequestException('Kendinizi takip edemezsiniz');
    }
    const exists = await this.prisma.user.count({ where: { id: targetId } });
    if (!exists) throw new NotFoundException('Kullanıcı bulunamadı');

    const where = { followerId, followingId: targetId };
    const following = await toggleRelation(
      () => this.prisma.follow.deleteMany({ where }),
      () => this.prisma.follow.create({ data: where }),
    );
    if (following) {
      await this.notifications.notify({
        type: NotificationType.FOLLOW,
        recipientId: targetId,
        actorId: followerId,
      });
    }
    const followerCount = await this.prisma.follow.count({
      where: { followingId: targetId },
    });
    return { following, followerCount };
  }
}
