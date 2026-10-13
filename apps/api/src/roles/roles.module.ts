import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { RolesController } from './roles.controller';
import { RolesRepository } from './roles.repository';
import { RolesService } from './roles.service';
@Module({
  imports: [AdminModule],
  controllers: [RolesController],
  providers: [RolesRepository, RolesService],
})
export class RolesModule {}
