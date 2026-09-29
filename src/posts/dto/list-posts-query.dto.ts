import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const LIST_STATUSES = ['PUBLISHED', 'DRAFT', 'ALL'] as const;
export type ListStatus = (typeof LIST_STATUSES)[number];

export const SORTS = ['new', 'popular'] as const;
export type PostSort = (typeof SORTS)[number];

export class ListPostsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Sayfa numarası tam sayı olmalı' })
  @Min(1, { message: 'Sayfa numarası en az 1 olmalı' })
  page = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Sayfa boyutu tam sayı olmalı' })
  @Min(1, { message: 'Sayfa boyutu 1-50 arasında olmalı' })
  @Max(50, { message: 'Sayfa boyutu 1-50 arasında olmalı' })
  limit = 10;

  @ApiPropertyOptional({ description: "Kategori slug'ı" })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Etiket adı' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ description: 'Yazarın kullanıcı adı' })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiPropertyOptional({
    description: 'true: yalnızca giriş yapan kullanıcının kaydettiği yazılar',
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  bookmarked?: boolean;

  @ApiPropertyOptional({
    enum: LIST_STATUSES,
    default: 'PUBLISHED',
    description:
      'DRAFT ve ALL yalnızca giriş yapmış kullanıcının kendi yazılarını döner',
  })
  @IsOptional()
  @IsIn(LIST_STATUSES, { message: 'Geçersiz durum filtresi' })
  status: ListStatus = 'PUBLISHED';

  @ApiPropertyOptional({
    description:
      'true: yalnızca giriş yapan kullanıcının takip ettiklerinin yazıları',
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  following?: boolean;

  @ApiPropertyOptional({
    enum: SORTS,
    default: 'new',
    description:
      'popular: beğeni, sonra yorum sayısına göre (yalnızca yayındaki yazılar)',
  })
  @IsOptional()
  @IsIn(SORTS, { message: 'Geçersiz sıralama' })
  sort: PostSort = 'new';
}
