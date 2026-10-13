import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ScopeModule } from '../scope/scope.module';
import { CatalogModule } from '../catalog/catalog.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryRepository } from './inventory.repository';
import { InventoryTransaction } from './inventory-transaction';
import { InventoryConfig } from './inventory.config';
import { InventoryWriteGuard } from './inventory-write.guard';
import { OpeningImportService } from './opening-import.service';
import { SalesController } from '../sales/sales.controller';
import { SalesService } from '../sales/sales.service';
@Module({
  imports: [AuthModule, ScopeModule, CatalogModule],
  controllers: [InventoryController, SalesController],
  providers: [
    InventoryService,
    InventoryRepository,
    InventoryTransaction,
    InventoryConfig,
    InventoryWriteGuard,
    OpeningImportService,
    SalesService,
  ],
  exports: [InventoryService],
})
export class InventoryModule {}
