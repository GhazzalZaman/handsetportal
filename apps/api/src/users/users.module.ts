import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
@Module({
  imports: [AdminModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
})
export class UsersModule {}
