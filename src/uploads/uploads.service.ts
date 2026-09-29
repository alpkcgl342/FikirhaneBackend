import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { POST_IMAGES_BUCKET } from '../posts/posts.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { detectImageType } from './image-type.util.js';

/** Vercel fonksiyonlarının istek gövdesi sınırı 4.5 MB olduğu için 4 MB. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async uploadImage(buffer: Buffer, userId: string, accessToken: string) {
    const type = detectImageType(buffer);
    if (!type) {
      throw new BadRequestException(
        'Yalnızca JPEG, PNG, WebP veya GIF görseller yüklenebilir',
      );
    }

    // Storage kuralı: kullanıcı yalnızca kendi kimliğiyle adlandırılmış klasöre yükleyebilir.
    const path = `${userId}/${randomUUID()}.${type.ext}`;
    const bucket = this.supabase
      .createUserClient(accessToken)
      .storage.from(POST_IMAGES_BUCKET);

    const { error } = await bucket.upload(path, buffer, {
      contentType: type.mime,
      cacheControl: '31536000',
      upsert: false,
    });
    if (error) {
      this.logger.error(`Görsel yüklenemedi: ${error.message}`);
      throw new BadGatewayException('Görsel yüklenemedi, tekrar deneyin');
    }

    return { url: bucket.getPublicUrl(path).data.publicUrl };
  }
}
