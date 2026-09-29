import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard.js';
import type { AuthUser } from '../../auth/token-verifier.service.js';

/** JwtAuthGuard'ın doğruladığı kullanıcıyı controller parametresine verir. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
