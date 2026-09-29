import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard, OptionalJwtAuthGuard } from './jwt-auth.guard.js';
import { TokenVerifierService } from './token-verifier.service.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenVerifierService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
  ],
  exports: [TokenVerifierService, JwtAuthGuard, OptionalJwtAuthGuard],
})
export class AuthModule {}
