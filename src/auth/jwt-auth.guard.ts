import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  TokenVerifierService,
  type AuthUser,
} from './token-verifier.service.js';

export type AuthenticatedRequest = Request & {
  user: AuthUser;
  /** Doğrulanmış ham token; Supabase Storage'a kullanıcı adına yükleme için kullanılır. */
  accessToken: string;
};

export type MaybeAuthenticatedRequest = Request & {
  user?: AuthUser;
  accessToken?: string;
};

export const BANNED_MESSAGE =
  'Hesabınız askıya alındı; içerik paylaşamaz ve etkileşimde bulunamazsınız';

function bearerToken(request: Request): string | null {
  const [scheme, token] = (request.headers.authorization ?? '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

/**
 * Token'ı doğrular, kullanıcının rolünü veritabanından ekler.
 * Engellenmiş kullanıcılar yalnızca okuma (GET) yapabilir.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly verifier: TokenVerifierService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = bearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Giriş yapmanız gerekiyor');
    }

    let user: AuthUser;
    try {
      user = await this.verifier.verify(token);
    } catch {
      throw new UnauthorizedException('Oturum geçersiz veya süresi dolmuş');
    }

    const profile = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, isBanned: true },
    });
    if (profile?.isBanned && request.method !== 'GET') {
      throw new ForbiddenException(BANNED_MESSAGE);
    }

    request.user = { ...user, role: profile?.role ?? Role.USER };
    request.accessToken = token;
    return true;
  }
}

/**
 * Herkese açık uç noktalar için: geçerli bir token varsa kullanıcıyı isteğe ekler,
 * yoksa ya da geçersizse isteği anonim olarak devam ettirir.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly verifier: TokenVerifierService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<MaybeAuthenticatedRequest>();
    const token = bearerToken(request);
    if (token) {
      try {
        request.user = await this.verifier.verify(token);
        request.accessToken = token;
      } catch {
        // Süresi dolmuş token herkese açık içeriğe erişimi engellemez.
      }
    }
    return true;
  }
}
