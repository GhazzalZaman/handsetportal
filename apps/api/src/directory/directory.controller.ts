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
import { Scope } from '../scope/scope.decorator';
import { CenterScope } from '../scope/scope.service';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import { AuthRequest, Principal, eventContext } from '../auth/auth.types';
import { IdDto, PageDto } from '../admin/admin.dto';
import {
  CreateCenterDto,
  CreateClusterDto,
  PatchCenterDto,
  PatchClusterDto,
} from './directory.dto';
import { DirectoryRepository } from './directory.repository';
import { DirectoryService } from './directory.service';
@Controller()
export class DirectoryController {
  constructor(
    private readonly repo: DirectoryRepository,
    private readonly service: DirectoryService,
  ) {}
  @Get('centers') centers(@Scope() scope: CenterScope, @Query() dto: PageDto) {
    return this.repo.centers(scope, dto);
  }
  @Get('clusters') clusters(
    @Scope() scope: CenterScope,
    @Query() dto: PageDto,
  ) {
    return this.repo.clusters(scope, dto);
  }
  @RequirePermissions('users.manage') @Get('clusters/catalog') catalog(
    @Scope() scope: CenterScope,
    @Query() dto: PageDto,
  ) {
    return this.repo.clusters(scope, dto, true);
  }
  @RequirePermissions('users.manage') @Post('centers') createCenter(
    @Body() dto: CreateCenterDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.createCenter(dto, actor, eventContext(req));
  }
  @RequirePermissions('users.manage') @Patch('centers/:id') patchCenter(
    @Param() { id }: IdDto,
    @Body() dto: PatchCenterDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.patchCenter(id, dto, actor, eventContext(req));
  }
  @RequirePermissions('users.manage') @Post('clusters') createCluster(
    @Body() dto: CreateClusterDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.createCluster(dto, actor, eventContext(req));
  }
  @RequirePermissions('users.manage') @Patch('clusters/:id') patchCluster(
    @Param() { id }: IdDto,
    @Body() dto: PatchClusterDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.patchCluster(id, dto, actor, eventContext(req));
  }
}
