import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import { Principal, AuthRequest, eventContext } from '../auth/auth.types';
import { IdDto } from '../admin/admin.dto';
import { CatalogRepository } from './catalog.repository';
import { CatalogService } from './catalog.service';
import {
  CatalogImportService,
  CsvUpload,
  csvSafe,
} from './catalog-import.service';
import {
  CatalogQueryDto,
  NameDto,
  ModelDto,
  SpecificationDto,
  SkuDto,
  HandsetDto,
  RenameDto,
  PatchSpecificationDto,
  PatchPriceDto,
  VersionDto,
  ImportQueryDto,
} from './catalog.dto';
// Global master data: deliberately not filtered by Experience Center scope.
@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly repo: CatalogRepository,
    private readonly service: CatalogService,
    private readonly imports: CatalogImportService,
  ) {}

  @Get('brands')
  @RequirePermissions('dashboard.view')
  brands(@Query() dto: CatalogQueryDto, @CurrentUser() actor: Principal) {
    return this.repo.list('brands', dto, actor.permissions);
  }

  @Get('models')
  @RequirePermissions('dashboard.view')
  models(@Query() dto: CatalogQueryDto, @CurrentUser() actor: Principal) {
    return this.repo.list('models', dto, actor.permissions);
  }

  @Get('colors')
  @RequirePermissions('dashboard.view')
  colors(@Query() dto: CatalogQueryDto, @CurrentUser() actor: Principal) {
    return this.repo.list('colors', dto, actor.permissions);
  }

  @Get('skus')
  @RequirePermissions('dashboard.view')
  skus(@Query() dto: CatalogQueryDto, @CurrentUser() actor: Principal) {
    return this.repo.list('skus', dto, actor.permissions);
  }

  @Get('specifications')
  @RequirePermissions('dashboard.view')
  specifications(
    @Query() dto: CatalogQueryDto,
    @CurrentUser() actor: Principal,
  ) {
    return this.repo.list('specifications', dto, actor.permissions);
  }

  @Patch('skus/:id/list-price')
  @RequirePermissions('masterdata.manage')
  listPrice(
    @Param() { id }: IdDto,
    @Body() dto: PatchPriceDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.patchPrice(id, dto, actor, eventContext(req));
  }

  @Get('brands/:id')
  @RequirePermissions('dashboard.view')
  brandsDetail(
    @Param() { id }: IdDto,
    @Query() dto: CatalogQueryDto,
    @CurrentUser() actor: Principal,
  ) {
    return this.repo.detail('brands', id, dto, actor.permissions);
  }

  @Get('models/:id')
  @RequirePermissions('dashboard.view')
  modelsDetail(
    @Param() { id }: IdDto,
    @Query() dto: CatalogQueryDto,
    @CurrentUser() actor: Principal,
  ) {
    return this.repo.detail('models', id, dto, actor.permissions);
  }

  @Get('lookups')
  @RequirePermissions('dashboard.view')
  lookups(@Query() dto: CatalogQueryDto) {
    return this.repo.lookups(dto);
  }
  @Post('handsets')
  @RequirePermissions('masterdata.create')
  handset(
    @Body() dto: HandsetDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.addHandset(dto, actor, eventContext(req));
  }
  @Get('import/template')
  @RequirePermissions('masterdata.manage')
  template(@Res() res: Response) {
    res
      .type('text/csv')
      .attachment('handset-catalog-template.csv')
      .send(
        [
          ['brand', 'model', 'ram_gb', 'storage_gb', 'color'],
          ['Samsung', 'Galaxy A16', '4', '128', 'Black'],
        ]
          .map((row) => row.map(csvSafe).join(','))
          .join('\r\n') + '\r\n',
      );
  }
  @Post('import')
  @RequirePermissions('masterdata.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
    }),
  )
  import(
    @UploadedFile() file: CsvUpload | undefined,
    @Query() query: ImportQueryDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.imports.run(file, query.dryRun, actor, eventContext(req));
  }

  @Post('brands')
  @RequirePermissions('masterdata.create')
  createbrands(
    @Body() dto: NameDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.create('brands', dto, actor, eventContext(req));
  }

  @Post('colors')
  @RequirePermissions('masterdata.create')
  createcolors(
    @Body() dto: NameDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.create('colors', dto, actor, eventContext(req));
  }

  @Post('models')
  @RequirePermissions('masterdata.create')
  createmodels(
    @Body() dto: ModelDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.create('models', dto, actor, eventContext(req));
  }

  @Post('models/:id/specifications')
  @RequirePermissions('masterdata.create')
  createspecifications(
    @Body() dto: SpecificationDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
    @Param() { id }: IdDto,
  ) {
    return this.service.create(
      'specifications',
      dto,
      actor,
      eventContext(req),
      id,
    );
  }

  @Post('models/:id/skus')
  @RequirePermissions('masterdata.create')
  createskus(
    @Body() dto: SkuDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
    @Param() { id }: IdDto,
  ) {
    return this.service.create('skus', dto, actor, eventContext(req), id);
  }

  @Patch('brands/:id')
  @RequirePermissions('masterdata.manage')
  patchbrands(
    @Param() { id }: IdDto,
    @Body() dto: RenameDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.patch('brands', id, dto, actor, eventContext(req));
  }

  @Post('brands/:id/activate')
  @RequirePermissions('masterdata.manage')
  activatebrands(
    @Param() { id }: IdDto,
    @Body() dto: VersionDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.status(
      'brands',
      id,
      true,
      dto.rowVersion,
      actor,
      eventContext(req),
    );
  }

  @Post('brands/:id/deactivate')
  @RequirePermissions('masterdata.manage')
  deactivatebrands(
    @Param() { id }: IdDto,
    @Body() dto: VersionDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.status(
      'brands',
      id,
      false,
      dto.rowVersion,
      actor,
      eventContext(req),
    );
  }

  @Patch('models/:id')
  @RequirePermissions('masterdata.manage')
  patchmodels(
    @Param() { id }: IdDto,
    @Body() dto: RenameDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.patch('models', id, dto, actor, eventContext(req));
  }

  @Post('models/:id/activate')
  @RequirePermissions('masterdata.manage')
  activatemodels(
    @Param() { id }: IdDto,
    @Body() dto: VersionDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.status(
      'models',
      id,
      true,
      dto.rowVersion,
      actor,
      eventContext(req),
    );
  }

  @Post('models/:id/deactivate')
  @RequirePermissions('masterdata.manage')
  deactivatemodels(
    @Param() { id }: IdDto,
    @Body() dto: VersionDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.status(
      'models',
      id,
      false,
      dto.rowVersion,
      actor,
      eventContext(req),
    );
  }

  @Patch('colors/:id')
  @RequirePermissions('masterdata.manage')
  patchcolors(
    @Param() { id }: IdDto,
    @Body() dto: RenameDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.patch('colors', id, dto, actor, eventContext(req));
  }

  @Post('colors/:id/activate')
  @RequirePermissions('masterdata.manage')
  activatecolors(
    @Param() { id }: IdDto,
    @Body() dto: VersionDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.status(
      'colors',
      id,
      true,
      dto.rowVersion,
      actor,
      eventContext(req),
    );
  }

  @Post('colors/:id/deactivate')
  @RequirePermissions('masterdata.manage')
  deactivatecolors(
    @Param() { id }: IdDto,
    @Body() dto: VersionDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.status(
      'colors',
      id,
      false,
      dto.rowVersion,
      actor,
      eventContext(req),
    );
  }

  @Patch('specifications/:id')
  @RequirePermissions('masterdata.manage')
  patchspecifications(
    @Param() { id }: IdDto,
    @Body() dto: PatchSpecificationDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.patch(
      'specifications',
      id,
      dto,
      actor,
      eventContext(req),
    );
  }

  @Post('specifications/:id/activate')
  @RequirePermissions('masterdata.manage')
  activatespecifications(
    @Param() { id }: IdDto,
    @Body() dto: VersionDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.status(
      'specifications',
      id,
      true,
      dto.rowVersion,
      actor,
      eventContext(req),
    );
  }

  @Post('specifications/:id/deactivate')
  @RequirePermissions('masterdata.manage')
  deactivatespecifications(
    @Param() { id }: IdDto,
    @Body() dto: VersionDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.status(
      'specifications',
      id,
      false,
      dto.rowVersion,
      actor,
      eventContext(req),
    );
  }

  @Post('skus/:id/activate')
  @RequirePermissions('masterdata.manage')
  activateskus(
    @Param() { id }: IdDto,
    @Body() dto: VersionDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.status(
      'skus',
      id,
      true,
      dto.rowVersion,
      actor,
      eventContext(req),
    );
  }

  @Post('skus/:id/deactivate')
  @RequirePermissions('masterdata.manage')
  deactivateskus(
    @Param() { id }: IdDto,
    @Body() dto: VersionDto,
    @CurrentUser() actor: Principal,
    @Req() req: AuthRequest,
  ) {
    return this.service.status(
      'skus',
      id,
      false,
      dto.rowVersion,
      actor,
      eventContext(req),
    );
  }
}
