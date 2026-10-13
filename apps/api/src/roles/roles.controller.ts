import { Body, Controller, Get, Param, Put, Query, Req } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import { AuthRequest, Principal, eventContext } from '../auth/auth.types';
import { IdDto, PageDto } from '../admin/admin.dto';
import { RolePermissionsDto } from './roles.dto';
import { RolesRepository } from './roles.repository';
import { RolesService } from './roles.service';
@Controller()
@RequirePermissions('users.manage')
export class RolesController {
  constructor(
    private readonly repo: RolesRepository,
    private readonly service: RolesService,
  ) {}
  @Get('roles') roles(@Query() dto: PageDto) {
    return this.repo.roles(dto);
  }
  @Get('permissions') permissions(@Query() dto: PageDto) {
    return this.repo.permissions(dto);
  }
  @Put('roles/:id/permissions') replace(
    @Param() { id }: IdDto,
    @Body() dto: RolePermissionsDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.replace(
      id,
      dto.permissionCodes,
      actor,
      eventContext(req),
    );
  }
}
