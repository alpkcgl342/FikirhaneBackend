import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { TokenVerifierService } from './token-verifier.service.js';

function contextWith(authorization?: string, method = 'POST') {
  const request: Record<string, unknown> = {
    method,
    headers: { authorization },
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

function setup(profile: unknown = { role: 'USER', isBanned: false }) {
  const verifier = { verify: vi.fn().mockResolvedValue(user) };
  const prisma = { user: { findUnique: vi.fn().mockResolvedValue(profile) } };
  const guard = new JwtAuthGuard(
    verifier as unknown as TokenVerifierService,
    prisma as unknown as PrismaService,
  );
  return { guard, verifier, prisma };
}

const user = { id: 'u1', email: 'ayse@example.com' };

describe('JwtAuthGuard', () => {
  it('geçerli token ile kullanıcıyı rolüyle birlikte isteğe ekler', async () => {
    const { guard, verifier } = setup({ role: 'MODERATOR', isBanned: false });
    const { context, request } = contextWith('Bearer gecerli');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifier.verify).toHaveBeenCalledWith('gecerli');
    expect(request.user).toEqual({ ...user, role: 'MODERATOR' });
    expect(request.accessToken).toBe('gecerli');
  });

  it('profil satırı yoksa rol USER kabul edilir', async () => {
    const { guard } = setup(null);
    const { context, request } = contextWith('Bearer gecerli');

    await guard.canActivate(context);
    expect(request.user).toEqual({ ...user, role: 'USER' });
  });

  it('engellenmiş kullanıcı yazma isteği yapamaz', async () => {
    const { guard } = setup({ role: 'USER', isBanned: true });

    await expect(
      guard.canActivate(contextWith('Bearer gecerli', 'POST').context),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('engellenmiş kullanıcı okuma (GET) yapabilir', async () => {
    const { guard } = setup({ role: 'USER', isBanned: true });

    await expect(
      guard.canActivate(contextWith('Bearer gecerli', 'GET').context),
    ).resolves.toBe(true);
  });

  it.each([undefined, '', 'gecerli', 'Basic abc', 'Bearer '])(
    'Authorization başlığı "%s" ise 401 döner',
    async (header) => {
      const { guard, verifier } = setup();

      await expect(
        guard.canActivate(contextWith(header).context),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(verifier.verify).not.toHaveBeenCalled();
    },
  );

  it('doğrulanamayan token için 401 döner', async () => {
    const { guard, verifier } = setup();
    verifier.verify.mockRejectedValue(new Error('imza geçersiz'));

    await expect(
      guard.canActivate(contextWith('Bearer sahte').context),
    ).rejects.toThrow('Oturum geçersiz veya süresi dolmuş');
  });
});
