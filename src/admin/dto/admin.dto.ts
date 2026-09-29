import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ReportStatus, Role } from '../../generated/prisma/enums.js';

class PageQuery {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Sayfa numarası tam sayı olmalı' })
  @Min(1, { message: 'Sayfa numarası en az 1 olmalı' })
  page = 1;
}

export class AdminReportsQueryDto extends PageQuery {
  @ApiPropertyOptional({ enum: ReportStatus, default: ReportStatus.PENDING })
  @IsOptional()
  @IsEnum(ReportStatus, { message: 'Geçersiz durum' })
  status: ReportStatus = ReportStatus.PENDING;
}

export class AdminUsersQueryDto extends PageQuery {
  @ApiPropertyOptional({ description: 'Ad, kullanıcı adı veya e-posta' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class ResolveReportDto {
  @ApiProperty({ enum: [ReportStatus.RESOLVED, ReportStatus.DISMISSED] })
  @IsIn([ReportStatus.RESOLVED, ReportStatus.DISMISSED], {
    message: 'Durum RESOLVED veya DISMISSED olmalı',
  })
  status: ReportStatus;
}

export class SetBanDto {
  @ApiProperty()
  @IsBoolean({ message: 'banned true ya da false olmalı' })
  banned: boolean;
}

export class SetRoleDto {
  @ApiProperty({ enum: Role })
  @IsEnum(Role, { message: 'Geçersiz rol' })
  role: Role;
}
