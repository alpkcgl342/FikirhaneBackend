import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthUser } from '../auth/token-verifier.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  updateMe(@Body() dto: UpdateProfileDto, @CurrentUser() user: AuthUser) {
    return this.users.updateMe(user.id, dto);
  }

  @Get(':username')
  @UseGuards(OptionalJwtAuthGuard)
  getProfile(
    @Param('username') username: string,
    @CurrentUser() viewer?: AuthUser,
  ) {
    return this.users.getProfile(username, viewer);
  }

  @Post(':id/follow')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  follow(
    @Param('id', ParseUUIDPipe) targetId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.toggleFollow(targetId, user.id);
  }
}
