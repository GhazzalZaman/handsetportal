import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { ScopeModule } from '../scope/scope.module';
import { DirectoryRepository } from './directory.repository';
import { DirectoryService } from './directory.service';
import { DirectoryController } from './directory.controller';
@Module({
  imports: [AdminModule, ScopeModule],
  controllers: [DirectoryController],
  providers: [DirectoryRepository, DirectoryService],
})
export class DirectoryModule {}
