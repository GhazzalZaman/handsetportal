import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Identity, Principal } from './auth.types';
export class LoginDto {
  @ApiProperty({ maxLength: 100 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  username!: string;
  @ApiProperty({ maxLength: 128, writeOnly: true })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
export class ChangePasswordDto {
  @ApiProperty({ writeOnly: true, maxLength: 128 })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword!: string;
  @ApiProperty({ writeOnly: true, maxLength: 128 })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  newPassword!: string;
}
export class EmptyDto {}
export class MeDto implements Identity {
  @ApiProperty() id!: number;
  @ApiProperty() username!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() role!: string;
  @ApiProperty({ type: [String] }) permissions!: string[];
  @ApiProperty() mustChangePassword!: boolean;
  @ApiProperty({ format: 'date-time' }) idleExpiresAt!: string;
  @ApiProperty({ format: 'date-time' }) absoluteExpiresAt!: string;
  static from(user: Principal): MeDto {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      permissions: user.permissions,
      mustChangePassword: user.mustChangePassword,
      idleExpiresAt: user.session.idleExpiresAt.toISOString(),
      absoluteExpiresAt: user.session.absoluteExpiresAt.toISOString(),
    };
  }
}
export class CsrfDto {
  @ApiProperty() csrfToken!: string;
}
