import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { SupabaseService } from '../supabase/supabase.service.js';
import { AuthService } from './auth.service.js';

const profile = {
  id: '11111111-1111-1111-1111-111111111111',
  username: 'ayse',
  email: 'ayse@example.com',
  displayName: 'Ayşe',
  bio: null,
  avatarUrl: null,
  role: 'USER' as const,
  createdAt: new Date('2026-09-29T00:00:00Z'),
};

const session = {
  access_token: 'access',
  refresh_token: 'refresh',
  expires_in: 3600,
  expires_at: 1790000000,
};

function setup() {
  const auth = {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    refreshSession: vi.fn(),
    verifyOtp: vi.fn(),
    resend: vi.fn(),
  };
  const prisma = {
    user: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  };
  const supabase = { createAuthClient: () => ({ auth }) };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    supabase as unknown as SupabaseService,
    { get: () => 'https://fikirhane.example/' } as unknown as ConfigService,
  );
  return { service, auth, prisma };
}

const registerDto = {
  email: 'ayse@example.com',
  password: 'guclu-sifre-123',
  username: 'ayse',
  displayName: 'Ayşe',
};

describe('AuthService', () => {
  describe('register', () => {
    it('kullanıcı adı alınmışsa Supabase çağrılmadan 409 döner', async () => {
      const { service, auth, prisma } = setup();
      prisma.user.findFirst.mockResolvedValue({ username: 'ayse' });

      await expect(service.register(registerDto)).rejects.toThrow(
        'Bu kullanıcı adı alınmış',
      );
      expect(auth.signUp).not.toHaveBeenCalled();
    });

    it('e-posta kayıtlıysa (kimliksiz sahte kullanıcı) 409 döner', async () => {
      const { service, auth, prisma } = setup();
      prisma.user.findFirst.mockResolvedValue(null);
      auth.signUp.mockResolvedValue({
        data: { user: { id: 'x', identities: [] }, session: null },
        error: null,
      });

      await expect(service.register(registerDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('e-posta doğrulaması gerekiyorsa oturumsuz profil döner', async () => {
      const { service, auth, prisma } = setup();
      prisma.user.findFirst.mockResolvedValue(null);
      auth.signUp.mockResolvedValue({
        data: { user: { id: profile.id, identities: [{}] }, session: null },
        error: null,
      });
      prisma.user.create.mockResolvedValue(profile);

      const result = await service.register(registerDto);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          id: profile.id,
          email: 'ayse@example.com',
          username: 'ayse',
          displayName: 'Ayşe',
        },
      });
      expect(result.session).toBeNull();
      expect(result.emailConfirmationRequired).toBe(true);
      expect(auth.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            emailRedirectTo:
              'https://fikirhane.example/pages/login.html?confirmed=1',
          }),
        }),
      );
      expect(result.user.username).toBe('ayse');
    });

    it('oturum açılırsa token bilgilerini döner', async () => {
      const { service, auth, prisma } = setup();
      prisma.user.findFirst.mockResolvedValue(null);
      auth.signUp.mockResolvedValue({
        data: { user: { id: profile.id, identities: [{}] }, session },
        error: null,
      });
      prisma.user.create.mockResolvedValue(profile);

      const result = await service.register(registerDto);

      expect(result.session).toEqual({
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresIn: 3600,
        expiresAt: 1790000000,
      });
      expect(result.emailConfirmationRequired).toBe(false);
    });

    it('profil yazılırken kullanıcı adı çakışırsa 409 döner', async () => {
      const { service, auth, prisma } = setup();
      prisma.user.findFirst.mockResolvedValue(null);
      auth.signUp.mockResolvedValue({
        data: { user: { id: profile.id, identities: [{}] }, session },
        error: null,
      });
      prisma.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: '7',
        }),
      );

      await expect(service.register(registerDto)).rejects.toThrow(
        'Bu kullanıcı adı alınmış',
      );
    });
  });

  describe('login', () => {
    it('hatalı bilgilerde 401 döner', async () => {
      const { service, auth } = setup();
      auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: {
          code: 'invalid_credentials',
          status: 400,
          message: 'Invalid login credentials',
        },
      });

      await expect(
        service.login({ email: 'ayse@example.com', password: 'yanlis' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('e-posta doğrulanmamışsa 403 döner', async () => {
      const { service, auth } = setup();
      auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: {
          code: 'email_not_confirmed',
          status: 400,
          message: 'Email not confirmed',
        },
      });

      await expect(
        service.login({ email: 'ayse@example.com', password: 'x' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('profil satırı yoksa metadata ile oluşturur', async () => {
      const { service, auth, prisma } = setup();
      auth.signInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: profile.id,
            email: 'Ayse@Example.com',
            user_metadata: { username: 'ayse', display_name: 'Ayşe' },
          },
          session,
        },
        error: null,
      });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(profile);

      const result = await service.login({
        email: 'ayse@example.com',
        password: 'x',
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          id: profile.id,
          email: 'ayse@example.com',
          username: 'ayse',
          displayName: 'Ayşe',
        },
      });
      expect(result.session.accessToken).toBe('access');
    });
  });

  describe('confirmEmail', () => {
    const loginUrl = 'https://fikirhane.example/pages/login.html';

    it('geçerli token ile başarı sayfasına yönlendirir', async () => {
      const { service, auth } = setup();
      auth.verifyOtp.mockResolvedValue({ data: {}, error: null });

      await expect(service.confirmEmail('hash', 'email')).resolves.toBe(
        `${loginUrl}?confirmed=1`,
      );
      expect(auth.verifyOtp).toHaveBeenCalledWith({
        token_hash: 'hash',
        type: 'email',
      });
    });

    it('süresi dolmuş token için hata sayfasına yönlendirir', async () => {
      const { service, auth } = setup();
      auth.verifyOtp.mockResolvedValue({
        data: {},
        error: { code: 'otp_expired', status: 403, message: 'expired' },
      });

      await expect(service.confirmEmail('hash', 'email')).resolves.toBe(
        `${loginUrl}?confirmed=0`,
      );
    });

    it.each([
      [undefined, 'email'],
      ['hash', 'recovery'],
      ['hash', undefined],
    ])(
      'eksik ya da desteklenmeyen parametrede (%s, %s) Supabase çağrılmaz',
      async (hash, type) => {
        const { service, auth } = setup();

        await expect(service.confirmEmail(hash, type)).resolves.toBe(
          `${loginUrl}?confirmed=0`,
        );
        expect(auth.verifyOtp).not.toHaveBeenCalled();
      },
    );
  });

  describe('resendConfirmation', () => {
    it('hesap olmasa da aynı yanıtı döner', async () => {
      const { service, auth } = setup();
      auth.resend.mockResolvedValue({
        data: {},
        error: { code: 'user_not_found', status: 400, message: 'x' },
      });

      await expect(
        service.resendConfirmation('yok@example.com'),
      ).resolves.toHaveProperty('message');
    });

    it('hız sınırında 429 döner', async () => {
      const { service, auth } = setup();
      auth.resend.mockResolvedValue({
        data: {},
        error: {
          code: 'over_email_send_rate_limit',
          status: 429,
          message: 'x',
        },
      });

      await expect(
        service.resendConfirmation('ayse@example.com'),
      ).rejects.toMatchObject({ status: 429 });
    });
  });

  describe('refresh', () => {
    it('geçersiz token için 401 döner', async () => {
      const { service, auth } = setup();
      auth.refreshSession.mockResolvedValue({
        data: { session: null, user: null },
        error: {
          code: 'validation_failed',
          status: 400,
          message: 'Refresh token is not valid',
        },
      });

      await expect(service.refresh('bozuk')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
