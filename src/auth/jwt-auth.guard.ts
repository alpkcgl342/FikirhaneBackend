import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  TokenVerifierService,
  type AuthUser,
} from './token-verifier.service.js';

export type AuthenticatedRequest = Request & { user: AuthUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly verifier: TokenVerifierService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Giriş yapmanız gerekiyor');
    }
    try {
      request.user = await this.verifier.verify(token);
    } catch {
      throw new UnauthorizedException('Oturum geçersiz veya süresi dolmuş');
    }
    return true;
  }
}
