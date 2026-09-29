import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'Çok faydalı bir yazı, teşekkürler!' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 2000, { message: 'Yorum 1-2000 karakter olmalı' })
  content: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Yanıt verilen yorumun kimliği',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Geçersiz yorum' })
  parentId?: string;
}
