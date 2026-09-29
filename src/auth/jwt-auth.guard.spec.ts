import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { TokenVerifierService } from './token-verifier.service.js';

function contextWith(authorization?: string) {
  const request: Record<string, unknown> = { headers: { authorization } };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('JwtAuthGuard', () => {
  const user = { id: 'u1', email: 'ayse@example.com' };

  it('geçerli token ile kullanıcıyı isteğe ekler', async () => {
    const verifier = { verify: vi.fn().mockResolvedValue(user) };
    const guard = new JwtAuthGuard(verifier as unknown as TokenVerifierService);
    const { context, request } = contextWith('Bearer gecerli');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifier.verify).toHaveBeenCalledWith('gecerli');
    expect(request.user).toEqual(user);
  });

  it.each([undefined, '', 'gecerli', 'Basic abc', 'Bearer '])(
    'Authorization başlığı "%s" ise 401 döner',
    async (header) => {
      const verifier = { verify: vi.fn() };
      const guard = new JwtAuthGuard(
        verifier as unknown as TokenVerifierService,
      );

      await expect(
        guard.canActivate(contextWith(header).context),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(verifier.verify).not.toHaveBeenCalled();
    },
  );

  it('doğrulanamayan token için 401 döner', async () => {
    const verifier = {
      verify: vi.fn().mockRejectedValue(new Error('imza geçersiz')),
    };
    const guard = new JwtAuthGuard(verifier as unknown as TokenVerifierService);

    await expect(
      guard.canActivate(contextWith('Bearer sahte').context),
    ).rejects.toThrow('Oturum geçersiz veya süresi dolmuş');
  });
});
