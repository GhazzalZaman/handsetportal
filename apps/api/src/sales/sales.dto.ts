import { Transform } from 'class-transformer';
import {
  IsInt,
  Min,
  Max,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  IsUUID,
  IsISO8601,
  IsBoolean,
  Matches,
} from 'class-validator';
import {
  StockPairDto,
  InventoryQueryDto,
  receivedFrom,
} from '../inventory/inventory.dto';
export class SaleDto extends StockPairDto {
  @IsInt() @Min(1) @Max(50) quantity!: number;
  @IsIn(['CASH', 'INSTALLMENT', 'FNF']) salesType!: string;
  @IsOptional() @IsIn(receivedFrom) dispatchSource?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  soldAt?: string;
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  backdateReason?: string;
  @IsUUID() clientRequestId!: string;
}
export class VoidDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}
export class SaleIdDto {
  @Matches(/^[1-9]\d{0,18}$/) id!: string;
}
export class SalesQueryDto extends InventoryQueryDto {
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  includeVoided = false;
  @IsOptional() @IsIn(['CASH', 'INSTALLMENT', 'FNF']) salesType?: string;
}
