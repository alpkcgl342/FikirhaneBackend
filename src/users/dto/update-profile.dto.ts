import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Ayşe Yılmaz' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 60, { message: 'Görünen ad 1-60 karakter olmalı' })
  displayName?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 300 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300, { message: 'Biyografi en fazla 300 karakter olabilir' })
  bio?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'POST /uploads/image ile yüklenen görselin adresi',
  })
  @IsOptional()
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'Geçersiz profil fotoğrafı adresi' },
  )
  avatarUrl?: string | null;
}
