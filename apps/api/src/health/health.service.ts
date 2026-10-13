import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
@Injectable()
export class HealthService {
  constructor(private readonly database: DataSource) {}
  async checkDatabase(): Promise<void> {
    try {
      await this.database.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException();
    }
  }
}
