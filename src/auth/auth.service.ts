import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AuthError,
  Session,
  User as SupabaseUser,
} from '@supabase/supabase-js';
import { Prisma, type User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: number | null;
}

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  role: User['role'];
  createdAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly webUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    config: ConfigService,
  ) {
    this.webUrl = config
      .get<string>('WEB_URL', 'http://localhost:5173')
      .replace(/\/+$/, '');
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ username: dto.username }, { email: dto.email }] },
      select: { username: true },
    });
    if (existing) {
      throw new ConflictException(
        existing.username === dto.username
          ? 'Bu kullanıcı adı alınmış'
          : 'Bu e-posta ile zaten bir hesap var',
      );
    }

    const { data, error } = await this.supabase.createAuthClient().auth.signUp({
      email: dto.email,
      password: dto.password,
      options: {
        data: { username: dto.username, display_name: dto.displayName },
      },
    });
    if (error) throw this.toHttpError(error);
    // E-posta doğrulaması açıkken kayıtlı bir e-posta tekrar kullanılırsa Supabase,
    // hesabın varlığını gizlemek için kimliği olmayan sahte bir kullanıcı döner.
    if (!data.user || data.user.identities?.length === 0) {
      throw new ConflictException('Bu e-posta ile zaten bir hesap var');
    }

    let profile: User;
    try {
      profile = await this.prisma.user.create({
        data: {
          id: data.user.id,
          email: dto.email,
          username: dto.username,
          displayName: dto.displayName,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Bu kullanıcı adı alınmış');
      }
      throw e;
    }

    return {
      user: toPublicUser(profile),
      session: data.session ? toTokens(data.session) : null,
      emailConfirmationRequired: !data.session,
    };
  }

  /**
   * E-postadaki doğrulama bağlantısı ({{ .SiteURL }}/api/auth/confirm?token_hash=…&type=email)
   * buraya gelir. Sonuç, token'lar URL'de taşınmadan giriş sayfasına yönlendirilerek bildirilir.
   */
  async confirmEmail(tokenHash: string | undefined, type: string | undefined) {
    const loginUrl = `${this.webUrl}/pages/login.html`;
    if (!tokenHash || (type !== 'email' && type !== 'signup')) {
      return `${loginUrl}?confirmed=0`;
    }
    const { error } = await this.supabase
      .createAuthClient()
      .auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      this.logger.warn(`E-posta doğrulanamadı: ${error.code ?? error.message}`);
      return `${loginUrl}?confirmed=0`;
    }
    return `${loginUrl}?confirmed=1`;
  }

  /**
   * Doğrulama e-postasını yeniden gönderir. Hesabın varlığını ele vermemek için
   * hız sınırı dışındaki durumlarda her zaman aynı yanıt döner.
   */
  async resendConfirmation(email: string) {
    const { error } = await this.supabase
      .createAuthClient()
      .auth.resend({ type: 'signup', email });
    if (
      error?.code === 'over_email_send_rate_limit' ||
      error?.code === 'over_request_rate_limit'
    ) {
      throw this.toHttpError(error);
    }
    if (error) {
      this.logger.warn(
        `Doğrulama e-postası gönderilemedi: ${error.code ?? error.message}`,
      );
    }
    return {
      message:
        'Bu adrese ait doğrulanmamış bir hesap varsa yeni bir doğrulama e-postası gönderildi.',
    };
  }

  async login(dto: LoginDto) {
    const { data, error } = await this.supabase
      .createAuthClient()
      .auth.signInWithPassword({
        email: dto.email,
        password: dto.password,
      });
    if (error) throw this.toHttpError(error);

    const profile = await this.ensureProfile(data.user);
    return { user: toPublicUser(profile), session: toTokens(data.session) };
  }

  async refresh(refreshToken: string) {
    const { data, error } = await this.supabase
      .createAuthClient()
      .auth.refreshSession({ refresh_token: refreshToken });
    // Geçersiz, kullanılmış ya da biçimi bozuk her token için istemci yeniden giriş yapmalı.
    if (error && error.status && error.status >= 400 && error.status < 500) {
      throw new UnauthorizedException(
        'Oturum sona erdi, lütfen tekrar giriş yapın',
      );
    }
    if (error) throw this.toHttpError(error);
    if (!data.session) {
      throw new UnauthorizedException(
        'Oturum yenilenemedi, lütfen tekrar giriş yapın',
      );
    }
    return { session: toTokens(data.session) };
  }

  async me(userId: string) {
    const profile = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!profile) throw new NotFoundException('Kullanıcı bulunamadı');
    return { user: toPublicUser(profile) };
  }

  /**
   * Kayıt sırasında Supabase Auth kullanıcısı oluşup profil satırı yazılamadıysa
   * (ör. aynı anda aynı kullanıcı adıyla kayıt), ilk girişte profil tamamlanır.
   */
  private async ensureProfile(authUser: SupabaseUser): Promise<User> {
    const found = await this.prisma.user.findUnique({
      where: { id: authUser.id },
    });
    if (found) return found;

    const meta = authUser.user_metadata ?? {};
    const email = (authUser.email ?? '').toLowerCase();
    const base = sanitizeUsername(String(meta.username ?? email.split('@')[0]));
    const displayName = String(meta.display_name ?? base).slice(0, 60);

    for (let attempt = 0; attempt < 5; attempt++) {
      const username =
        attempt === 0 ? base : `${base.slice(0, 25)}_${randomSuffix()}`;
      try {
        return await this.prisma.user.create({
          data: { id: authUser.id, email, username, displayName },
        });
      } catch (e) {
        if (!(
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ))
          throw e;
      }
    }
    throw new ConflictException('Profil oluşturulamadı, lütfen tekrar deneyin');
  }

  private toHttpError(error: AuthError): HttpException {
    switch (error.code) {
      case 'user_already_exists':
      case 'email_exists':
        return new ConflictException('Bu e-posta ile zaten bir hesap var');
      case 'weak_password':
        return new BadRequestException(
          'Şifre çok zayıf, daha güçlü bir şifre seçin',
        );
      case 'email_address_invalid':
        return new BadRequestException('Bu e-posta adresi kullanılamıyor');
      case 'invalid_credentials':
        return new UnauthorizedException('E-posta veya şifre hatalı');
      case 'email_not_confirmed':
        return new ForbiddenException(
          'Giriş yapmadan önce e-posta adresinizi doğrulayın',
        );
      case 'refresh_token_not_found':
      case 'refresh_token_already_used':
      case 'session_not_found':
      case 'session_expired':
        return new UnauthorizedException(
          'Oturum sona erdi, lütfen tekrar giriş yapın',
        );
      case 'over_email_send_rate_limit':
      case 'over_request_rate_limit':
        return new HttpException(
          'Çok fazla deneme yapıldı, lütfen biraz sonra tekrar deneyin',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      case 'signup_disabled':
      case 'email_provider_disabled':
        return new ForbiddenException('Şu anda yeni kayıt alınmıyor');
    }
    if (error.status && error.status >= 400 && error.status < 500) {
      return new BadRequestException('İstek işlenemedi');
    }
    this.logger.error(
      `Supabase Auth hatası: ${error.code ?? '-'} ${error.message}`,
    );
    return new BadGatewayException('Kimlik doğrulama servisine ulaşılamadı');
  }
}

function toTokens(session: Session): SessionTokens {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in,
    expiresAt: session.expires_at ?? null,
  };
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    role: user.role,
    createdAt: user.createdAt,
  };
}

function sanitizeUsername(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 30);
  return cleaned.length >= 3 ? cleaned : `kullanici_${randomSuffix()}`;
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}
