import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { MaybeAuthenticatedRequest } from '../../auth/jwt-auth.guard.js';
import type { AuthUser } from '../../auth/token-verifier.service.js';

/**
 * JwtAuthGuard'ın doğruladığı kullanıcıyı controller parametresine verir.
 * OptionalJwtAuthGuard ile kullanıldığında anonim isteklerde `undefined` olur.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser | undefined =>
    context.switchToHttp().getRequest<MaybeAuthenticatedRequest>().user,
);

/** Doğrulanmış ham access token (yalnızca JwtAuthGuard'lı uç noktalarda dolu). */
export const AccessToken = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined =>
    context.switchToHttp().getRequest<MaybeAuthenticatedRequest>().accessToken,
);
