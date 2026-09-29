import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { PostStatus } from '../../generated/prisma/enums.js';

export const MAX_TAGS = 5;

export class CreatePostDto {
  @ApiProperty({ example: 'Yapay zekâya giriş' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(3, 200, { message: 'Başlık 3-200 karakter olmalı' })
  title: string;

  @ApiProperty({ description: 'Markdown içerik' })
  @IsString()
  @Length(1, 100_000, { message: 'İçerik 1-100.000 karakter olmalı' })
  content: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('all', { message: 'Geçersiz kategori' })
  categoryId?: string | null;

  @ApiPropertyOptional({
    type: [String],
    maxItems: MAX_TAGS,
    example: ['yapay zeka'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TAGS, {
    message: `En fazla ${MAX_TAGS} etiket eklenebilir`,
  })
  @IsString({ each: true })
  @Length(2, 30, { each: true, message: 'Her etiket 2-30 karakter olmalı' })
  @Matches(/^[\p{L}\p{N}][\p{L}\p{N} -]*$/u, {
    each: true,
    message: 'Etiketler yalnızca harf, rakam, boşluk ve - içerebilir',
  })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'POST /uploads/image ile yüklenen görselin adresi',
    nullable: true,
  })
  @IsOptional()
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'Geçersiz kapak görseli adresi' },
  )
  coverUrl?: string | null;

  @ApiPropertyOptional({ enum: PostStatus, default: PostStatus.DRAFT })
  @IsOptional()
  @IsEnum(PostStatus, { message: 'Geçersiz durum' })
  status?: PostStatus;
}
