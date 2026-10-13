import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ScopeModule } from '../scope/scope.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CatalogRepository } from './catalog.repository';
import { CatalogNormalizer } from './catalog-normalizer';
import { CatalogTransaction } from './catalog-transaction';
import { CatalogImportService } from './catalog-import.service';
@Module({
  imports: [AuthModule, ScopeModule],
  controllers: [CatalogController],
  providers: [
    CatalogService,
    CatalogRepository,
    CatalogNormalizer,
    CatalogTransaction,
    CatalogImportService,
  ],
  exports: [
    CatalogService,
    CatalogRepository,
    CatalogTransaction,
    CatalogNormalizer,
  ],
})
export class CatalogModule {}
