import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, IsUUID, Length } from 'class-validator';
import { ReportTargetType } from '../../generated/prisma/enums.js';

export class CreateReportDto {
  @ApiProperty({ enum: ReportTargetType })
  @IsEnum(ReportTargetType, { message: 'Geçersiz şikâyet türü' })
  targetType: ReportTargetType;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'Geçersiz hedef' })
  targetId: string;

  @ApiProperty({ example: 'Hakaret içeriyor', minLength: 5, maxLength: 1000 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(5, 1000, { message: 'Şikâyet nedeni 5-1000 karakter olmalı' })
  reason: string;
}
