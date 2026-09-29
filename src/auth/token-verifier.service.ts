import { Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { Role } from '../generated/prisma/enums.js';
import { SupabaseService } from '../supabase/supabase.service.js';

export interface AuthUser {
  id: string;
  email: string;
  /** JwtAuthGuard tarafından veritabanından eklenir (token'da yoktur). */
  role?: Role;
}

/**
 * Supabase Auth'un verdiği access token'ları, projenin herkese açık JWKS anahtarlarıyla
 * (ES256) doğrular. Sunucuda gizli JWT anahtarı tutmak gerekmez; anahtarlar önbelleğe alınır.
 */
@Injectable()
export class TokenVerifierService {
  private readonly jwks: JWTVerifyGetKey;
  private readonly issuer: string;

  constructor(supabase: SupabaseService) {
    this.issuer = `${supabase.projectUrl}/auth/v1`;
    this.jwks = createRemoteJWKSet(
      new URL(`${this.issuer}/.well-known/jwks.json`),
    );
  }

  async verify(token: string): Promise<AuthUser> {
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: this.issuer,
      audience: 'authenticated',
    });
    if (!payload.sub) {
      throw new Error('Token içinde kullanıcı kimliği yok');
    }
    return {
      id: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : '',
    };
  }
}
