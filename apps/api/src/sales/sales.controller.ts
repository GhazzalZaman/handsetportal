import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Scope } from '../scope/scope.decorator';
import { CenterScope } from '../scope/scope.service';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import { Principal, AuthRequest, eventContext } from '../auth/auth.types';
import { InventoryRepository } from '../inventory/inventory.repository';
import { InventoryWriteGuard } from '../inventory/inventory-write.guard';
import { SalesService } from './sales.service';
import { SaleDto, VoidDto, SaleIdDto, SalesQueryDto } from './sales.dto';
@Controller('sales')
export class SalesController {
  constructor(
    private readonly repo: InventoryRepository,
    private readonly service: SalesService,
  ) {}
  @Get() @RequirePermissions('dashboard.view') list(
    @Scope() scope: CenterScope,
    @Query() dto: SalesQueryDto,
  ) {
    return this.repo.sales(scope, dto);
  }
  @Get(':id') @RequirePermissions('dashboard.view') detail(
    @Scope() scope: CenterScope,
    @Query() dto: SalesQueryDto,
    @Param() { id }: SaleIdDto,
  ) {
    return this.repo.sales(scope, dto, id);
  }
  @Post()
  @RequirePermissions('sales.record')
  @UseGuards(InventoryWriteGuard)
  record(
    @Body() dto: SaleDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.record(dto, actor, eventContext(req));
  }
  @Post(':id/void')
  @RequirePermissions('dashboard.view')
  @UseGuards(InventoryWriteGuard)
  void(
    @Param() { id }: SaleIdDto,
    @Body() dto: VoidDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.void(id, dto.reason, actor, eventContext(req));
  }
}
