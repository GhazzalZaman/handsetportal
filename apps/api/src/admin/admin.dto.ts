import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  Min,
  Max,
  IsOptional,
  IsString,
  MaxLength,
  IsBoolean,
} from 'class-validator';
export class IdDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) id!: number;
}
export class PageDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
}
export class UserQueryDto extends PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) roleId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) centerId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) clusterId?: number;
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  isActive?: boolean;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
}
export function pageResult<T>(items: T[], total: number, dto: PageDto) {
  return { items, total, page: dto.page, pageSize: dto.pageSize };
}
