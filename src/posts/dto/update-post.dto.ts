import { PartialType } from '@nestjs/swagger';
import { CreatePostDto } from './create-post.dto.js';

/** Gönderilen alanlar güncellenir; kategori ve kapak `null` gönderilerek kaldırılır. */
export class UpdatePostDto extends PartialType(CreatePostDto) {}
