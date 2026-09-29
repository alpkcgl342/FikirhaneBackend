import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles, RolesGuard } from '../auth/roles.guard.js';
import type { AuthUser } from '../auth/token-verifier.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { AdminService } from './admin.service.js';
import {
  AdminReportsQueryDto,
  AdminUsersQueryDto,
  ResolveReportDto,
  SetBanDto,
  SetRoleDto,
} from './dto/admin.dto.js';

/** Moderasyon: tüm uç noktalar MODERATOR veya ADMIN ister; rol değişikliği yalnızca ADMIN. */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.MODERATOR, Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('reports')
  listReports(@Query() query: AdminReportsQueryDto) {
    return this.admin.listReports(query.status, query.page);
  }

  @Patch('reports/:id')
  resolveReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveReportDto,
  ) {
    return this.admin.resolveReport(id, dto.status);
  }

  @Delete('posts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePost(@Param('id', ParseUUIDPipe) id: string) {
    await this.admin.removePost(id);
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeComment(@Param('id', ParseUUIDPipe) id: string) {
    await this.admin.removeComment(id);
  }

  @Get('users')
  listUsers(@Query() query: AdminUsersQueryDto) {
    return this.admin.listUsers(query.q, query.page);
  }

  @Patch('users/:id/ban')
  setBan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetBanDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.admin.setBan(actor, id, dto.banned);
  }

  @Patch('users/:id/role')
  @Roles(Role.ADMIN)
  setRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetRoleDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.admin.setRole(actor, id, dto.role);
  }
}
