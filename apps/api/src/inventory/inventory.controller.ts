import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Scope } from '../scope/scope.decorator';
import { CenterScope } from '../scope/scope.service';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import { Principal, AuthRequest, eventContext } from '../auth/auth.types';
import { CsvUpload } from '../catalog/catalog-import.service';
import { InventoryRepository } from './inventory.repository';
import { InventoryService } from './inventory.service';
import {
  InventoryQueryDto,
  ReceiptDto,
  AdjustmentDto,
  StockPairDto,
  ThresholdDto,
  OpeningImportDto,
} from './inventory.dto';
import { OpeningImportService, openingHeader } from './opening-import.service';
import { InventoryWriteGuard } from './inventory-write.guard';
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly repo: InventoryRepository,
    private readonly service: InventoryService,
    private readonly imports: OpeningImportService,
  ) {}
  @Get() @RequirePermissions('dashboard.view') list(
    @Scope() scope: CenterScope,
    @Query() dto: InventoryQueryDto,
  ) {
    return this.repo.inventory(scope, dto);
  }
  @Get('movements') @RequirePermissions('dashboard.view') movements(
    @Scope() scope: CenterScope,
    @Query() dto: InventoryQueryDto,
  ) {
    return this.repo.movements(scope, dto);
  }
  @Post('receipts')
  @RequirePermissions('inventory.receive')
  @UseGuards(InventoryWriteGuard)
  receive(
    @Body() dto: ReceiptDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.receive(dto, actor, eventContext(req));
  }
  @Post('adjustments')
  @RequirePermissions('inventory.adjust')
  @UseGuards(InventoryWriteGuard)
  adjust(
    @Body() dto: AdjustmentDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.adjust(dto, actor, eventContext(req));
  }
  @Patch(':centerId/:skuId/threshold')
  @RequirePermissions('inventory.adjust')
  @UseGuards(InventoryWriteGuard)
  threshold(
    @Param() pair: StockPairDto,
    @Body() dto: ThresholdDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.threshold(
      pair.centerId,
      pair.skuId,
      dto.lowStockThreshold,
      actor,
      eventContext(req),
    );
  }
  @Get('opening-stock/template')
  @RequirePermissions('inventory.import')
  template(@Res() res: Response) {
    res
      .type('text/csv')
      .attachment('opening-stock-template.csv')
      .send(openingHeader.join(',') + '\r\n');
  }
  @Post('opening-stock/import')
  @RequirePermissions('inventory.import')
  @UseGuards(InventoryWriteGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2097152, files: 1, fields: 0 },
    }),
  )
  import(
    @UploadedFile() file: CsvUpload | undefined,
    @Query() dto: OpeningImportDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.imports.run(file, dto.dryRun, actor, eventContext(req));
  }
}
