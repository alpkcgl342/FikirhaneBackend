import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly url: string;
  private readonly publishableKey: string;

  constructor(config: ConfigService) {
    this.url = config.getOrThrow<string>('SUPABASE_URL');
    this.publishableKey = config.getOrThrow<string>('SUPABASE_PUBLISHABLE_KEY');
  }

  get projectUrl(): string {
    return this.url;
  }

  /**
   * Her kimlik doğrulama işlemi için yeni bir istemci oluşturulur; böylece
   * eşzamanlı isteklerde bir kullanıcının oturumu diğerine sızmaz.
   */
  /**
   * Kullanıcının access token'ıyla çalışan istemci; Storage RLS kuralları bu kullanıcıya
   * göre uygulanır (gizli anahtar gerekmez).
   */
  createUserClient(accessToken: string): SupabaseClient {
    return createClient(this.url, this.publishableKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  createAuthClient(): SupabaseClient {
    return createClient(this.url, this.publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
}
