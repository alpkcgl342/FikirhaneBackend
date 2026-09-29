import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @ApiProperty({ example: 'ayse@example.com' })
  @Transform(trimLower)
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi girin' })
  email: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8, { message: 'Şifre en az 8 karakter olmalı' })
  @MaxLength(72, { message: 'Şifre en fazla 72 karakter olabilir' })
  password: string;

  @ApiProperty({
    example: 'ayse_yilmaz',
    description: '3-30 karakter; küçük harf, rakam ve _',
  })
  @Transform(trimLower)
  @Matches(/^[a-z0-9_]{3,30}$/, {
    message:
      'Kullanıcı adı 3-30 karakter olmalı ve yalnızca küçük harf, rakam ve _ içermeli',
  })
  username: string;

  @ApiProperty({ example: 'Ayşe Yılmaz' })
  @Transform(trim)
  @IsString()
  @Length(1, 60, { message: 'Görünen ad 1-60 karakter olmalı' })
  displayName: string;
}
