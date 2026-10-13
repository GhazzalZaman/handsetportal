import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/public.decorator';
import { AuthService } from './auth.service';
import { AuthConfig } from './auth.config';
import { SessionCookie } from '../sessions/session-cookie.service';
import {
  CurrentUser,
  LoginEndpoint,
  PasswordChangeAllowed,
} from './auth.decorators';
import {
  ChangePasswordDto,
  CsrfDto,
  EmptyDto,
  LoginDto,
  MeDto,
} from './auth.dto';
import { AuthRequest, eventContext, Principal } from './auth.types';
import { csrfToken } from './crypto';
@ApiTags('authentication')
@PasswordChangeAllowed()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: SessionCookie,
    private readonly config: AuthConfig,
  ) {}
  @Public()
  @LoginEndpoint()
  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ type: MeDto })
  async login(
    @Body() dto: LoginDto,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MeDto> {
    const user = await this.auth.login(
      dto.username,
      dto.password,
      this.cookies.read(request),
      eventContext(request),
      request.get('user-agent') ?? '',
    );
    this.cookies.set(response, user.sessionId);
    return MeDto.from(user);
  }
  @Get('me')
  @ApiOkResponse({ type: MeDto })
  me(@CurrentUser() user: Principal): MeDto {
    return MeDto.from(user);
  }
  @Get('csrf')
  @ApiOkResponse({ type: CsrfDto })
  csrf(@CurrentUser() user: Principal): CsrfDto {
    return {
      csrfToken: csrfToken(this.config.values.CSRF_SECRET, user.sessionId),
    };
  }
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Body() _dto: EmptyDto,
    @CurrentUser() user: Principal,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(user, eventContext(request));
    this.cookies.clear(response);
  }
  @Post('change-password')
  @HttpCode(200)
  @ApiOkResponse({ type: MeDto })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: Principal,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MeDto> {
    const rotated = await this.auth.changePassword(
      user,
      dto.currentPassword,
      dto.newPassword,
      eventContext(request),
      request.get('user-agent') ?? '',
    );
    this.cookies.set(response, rotated.sessionId);
    return MeDto.from(rotated);
  }
}
