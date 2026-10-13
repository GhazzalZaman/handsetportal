import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsString,
  Matches,
  MaxLength,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class CreateClusterDto {
  @Transform(trim)
  @IsString()
  @Matches(/^[A-Za-z0-9_-]+$/)
  @MaxLength(40)
  code!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(120) name!: string;
}
export class PatchClusterDto {
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsBoolean() isActive?: boolean;
}
export class CreateCenterDto {
  @Transform(trim)
  @IsString()
  @Matches(/^[A-Za-z0-9_-]+$/)
  @MaxLength(40)
  code!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(160) name!: string;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  shortName?: string | null;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  clusterId?: number | null;
}
export class PatchCenterDto {
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  shortName?: string | null;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  clusterId?: number | null;
  @ValidateIf((_o, v) => v !== undefined) @IsBoolean() isActive?: boolean;
}
