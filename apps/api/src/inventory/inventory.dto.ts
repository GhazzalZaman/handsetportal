import { Type, Transform } from 'class-transformer';
import {
  IsInt,
  Min,
  Max,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  IsIn,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ArrayUnique,
  ValidateNested,
  IsBoolean,
  Matches,
  ValidateIf,
} from 'class-validator';
import { PageDto } from '../admin/admin.dto';
export const receivedFrom = ['WAREHOUSE', 'EXPERIENCE_CENTER'];
export class StockPairDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) centerId!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) skuId!: number;
}
export class InventoryQueryDto extends PageDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  centerId?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  skuId?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  brandId?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  modelId?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  colorId?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  specificationId?: number;
  @IsOptional() @IsIn(['IN_STOCK', 'LOW', 'ZERO']) stockStatus?: string;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) dateFrom?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) dateTo?: string;
}
export class ReceiptItemDto {
  @IsInt() @Min(1) @Max(2147483647) skuId!: number;
  @IsInt() @Min(1) @Max(1000000) quantity!: number;
}
export class ReceiptDto {
  @IsInt() @Min(1) @Max(2147483647) centerId!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((item: ReceiptItemDto) => item.skuId)
  @ValidateNested({ each: true })
  @Type(() => ReceiptItemDto)
  items!: ReceiptItemDto[];
  @IsIn(receivedFrom) receivedFrom!: string;
  @IsOptional() @IsInt() @Min(1) @Max(2147483647) sourceCenterId?: number;
  @IsOptional() @IsString() @MaxLength(160) reference?: string;
  @IsOptional() @IsBoolean() isOpeningStock?: boolean;
}
export class AdjustmentDto extends StockPairDto {
  @IsInt() @Min(0) @Max(2147483647) newQuantity!: number;
  @IsIn([
    'COUNT_CORRECTION',
    'DAMAGED',
    'LOST',
    'FOUND',
    'DATA_ENTRY_ERROR',
    'OTHER',
  ])
  reasonCode!: string;
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  note?: string;
}
export class ThresholdDto {
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  lowStockThreshold!: number | null;
}
export class OpeningImportDto {
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  dryRun = true;
}
