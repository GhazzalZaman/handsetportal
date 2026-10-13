import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class CreateUserDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(100) username!: string;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email?: string | null;
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  displayName!: string;
  @IsInt() @Min(1) @Max(2147483647) roleId!: number;
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(2147483647, { each: true })
  centerIds: number[] = [];
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(2147483647, { each: true })
  clusterIds: number[] = [];
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  temporaryPassword?: string;
}
export class PatchUserDto {
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  displayName?: string;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email?: string | null;
  @ValidateIf((_o, v) => v !== undefined)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  roleId?: number;
  @ValidateIf((_o, v) => v !== undefined)
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(2147483647, { each: true })
  centerIds?: number[];
  @ValidateIf((_o, v) => v !== undefined)
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(2147483647, { each: true })
  clusterIds?: number[];
}
