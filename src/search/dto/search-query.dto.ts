import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class SearchQueryDto {
  @ApiProperty({ example: 'yapay zeka', minLength: 2, maxLength: 100 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString({ message: 'Arama terimi gerekli' })
  @Length(2, 100, { message: 'Arama terimi 2-100 karakter olmalı' })
  q: string;

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
}
