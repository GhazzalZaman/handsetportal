import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminTransaction } from './admin-transaction';
@Module({
  imports: [AuthModule],
  providers: [AdminTransaction],
  exports: [AdminTransaction, AuthModule],
})
export class AdminModule {}
