import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { RequirePermissions, CurrentUser } from '../auth/auth.decorators';
import { AuthRequest, Principal, eventContext } from '../auth/auth.types';
import { EmptyDto } from '../auth/auth.dto';
import { PageDto, IdDto, UserQueryDto } from '../admin/admin.dto';
import { CreateUserDto, PatchUserDto } from './users.dto';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
@RequirePermissions('users.manage')
@Controller('users')
export class UsersController {
  constructor(
    private readonly service: UsersService,
    private readonly repository: UsersRepository,
  ) {}
  @Get() list(@Query() dto: UserQueryDto) {
    return this.repository.list(dto);
  }
  @Get(':id') detail(@Param() { id }: IdDto) {
    return this.repository.detail(id);
  }
  @Get(':id/sessions') sessions(@Param() { id }: IdDto, @Query() dto: PageDto) {
    return this.repository.sessions(id, dto);
  }
  @Post() create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.create(dto, actor, eventContext(req));
  }
  @Patch(':id') patch(
    @Param() { id }: IdDto,
    @Body() dto: PatchUserDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.patch(id, dto, actor, eventContext(req));
  }
  @Post(':id/activate') action0(
    @Param() { id }: IdDto,
    @Body() _dto: EmptyDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.action(id, 'activate', actor, eventContext(req));
  }
  @Post(':id/deactivate') action1(
    @Param() { id }: IdDto,
    @Body() _dto: EmptyDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.action(id, 'deactivate', actor, eventContext(req));
  }
  @Post(':id/reset-password') action2(
    @Param() { id }: IdDto,
    @Body() _dto: EmptyDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.action(id, 'reset-password', actor, eventContext(req));
  }
  @Post(':id/unlock') action3(
    @Param() { id }: IdDto,
    @Body() _dto: EmptyDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.action(id, 'unlock', actor, eventContext(req));
  }
  @Post(':id/revoke-sessions') action4(
    @Param() { id }: IdDto,
    @Body() _dto: EmptyDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.action(id, 'revoke-sessions', actor, eventContext(req));
  }
}
