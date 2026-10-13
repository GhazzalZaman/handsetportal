import { Type, Transform } from 'class-transformer';
import {
  IsDefined,
  IsString,
  MaxLength,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsOptional,
  ValidateNested,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateIf,
  Matches,
} from 'class-validator';
import { PageDto } from '../admin/admin.dto';
const bool = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;
export class CatalogQueryDto extends PageDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  ramGb?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  storageGb?: number;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Transform(bool) @IsBoolean() includeInactive?: boolean;
  @IsOptional() @Transform(bool) @IsBoolean() isActive?: boolean;
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
}
export class NameDto {
  @IsString() @MaxLength(300) name!: string;
  @ValidateIf((_, v) => v !== undefined) @IsBoolean() confirmDistinct?: boolean;
}
export class ModelDto extends NameDto {
  @IsInt() @Min(1) @Max(2147483647) brandId!: number;
}
export class SpecificationDto {
  @IsOptional() @IsInt() @Min(1) @Max(2147483647) ramGb?: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(2147483647) storageGb?: number | null;
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MaxLength(300)
  label?: string;
  @ValidateIf((_, v) => v !== undefined) @IsBoolean() confirmDistinct?: boolean;
}
export class ReferenceDto {
  @ValidateIf((_, v) => v !== undefined)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  id?: number;
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MaxLength(300)
  name?: string;
}
// Decimal strings preserve the entered amount without binary floating-point conversion.
export class PriceInputDto {
  @IsOptional()
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/)
  listPrice?: string | null;
}
export class VariantPriceDto extends PriceInputDto {
  @IsInt() @Min(0) @Max(29) colorIndex!: number;
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(29)
  specificationIndex!: number | null;
}
export class HandsetDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(900)
  @ValidateNested({ each: true })
  @Type(() => VariantPriceDto)
  variantPrices?: VariantPriceDto[];
  @IsDefined() @ValidateNested() @Type(() => ReferenceDto) brand!: ReferenceDto;
  @IsDefined() @ValidateNested() @Type(() => NameDto) model!: NameDto;
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => SpecificationDto)
  specifications!: SpecificationDto[];
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ReferenceDto)
  colors!: ReferenceDto[];
  @ValidateIf((_, v) => v !== undefined) @IsBoolean() confirmDistinct?: boolean;
}
export class SkuDto extends PriceInputDto {
  @IsOptional() @IsInt() @Min(1) @Max(2147483647) specificationId?:
    number | null;
  @IsInt() @Min(1) @Max(2147483647) colorId!: number;
}
export class VersionDto {
  @IsInt() @Min(1) @Max(2147483647) rowVersion!: number;
}
export class PatchPriceDto extends VersionDto {
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/)
  listPrice!: string | null;
}
export class RenameDto extends VersionDto {
  @IsString() @MaxLength(300) name!: string;
  @ValidateIf((_, v) => v !== undefined) @IsBoolean() confirmDistinct?: boolean;
}
export class PatchSpecificationDto extends SpecificationDto {
  @IsInt() @Min(1) @Max(2147483647) rowVersion!: number;
}
export class ImportQueryDto {
  @Transform(bool) @IsBoolean() dryRun = true;
}
