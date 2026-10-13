import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { positiveInteger } from '../config/database';
export function inventoryEnvironment(env: Record<string, unknown>) {
  const threshold = env.LOW_STOCK_THRESHOLD ?? 3;
  if (!/^\d+$/.test(String(threshold)) || Number(threshold) > 2147483647)
    throw Error('Invalid LOW_STOCK_THRESHOLD');
  return {
    LOW_STOCK_THRESHOLD: Number(threshold),
    SALES_BACKDATE_MAX_DAYS: positiveInteger(
      env.SALES_BACKDATE_MAX_DAYS,
      3,
      365,
    ),
    SALE_SELF_VOID_MINUTES: positiveInteger(
      env.SALE_SELF_VOID_MINUTES,
      10,
      1440,
    ),
  };
}
@Injectable()
export class InventoryConfig {
  readonly values: ReturnType<typeof inventoryEnvironment>;
  constructor(config: ConfigService) {
    this.values = inventoryEnvironment({
      LOW_STOCK_THRESHOLD: config.get('LOW_STOCK_THRESHOLD'),
      SALES_BACKDATE_MAX_DAYS: config.get('SALES_BACKDATE_MAX_DAYS'),
      SALE_SELF_VOID_MINUTES: config.get('SALE_SELF_VOID_MINUTES'),
    });
  }
}
