import { Injectable, OnModuleInit } from '@nestjs/common';
import { argon2id, hash, verify } from 'argon2';
import { randomBytes } from 'node:crypto';
import { AuthConfig } from './auth.config';
import { AuthError } from './auth.error';
const common = new Set([
  'password',
  'password123',
  'password1234',
  'password12345',
  'password123456',
  '123456789012',
  '1234567890123456',
  'qwertyuiop123',
  'qwerty12345678',
  'letmein123456',
  'welcome12345',
  'changeme12345',
  'administrator',
  'iloveyou12345',
]);
export function passwordAllowed(
  value: string,
  username: string,
  minimum: number,
  currentPassword?: string,
): boolean {
  return (
    value.length >= minimum &&
    value.length <= 128 &&
    value.toLowerCase() !== username.trim().toLowerCase() &&
    !common.has(value.toLowerCase()) &&
    value !== currentPassword
  );
}
@Injectable()
export class PasswordService implements OnModuleInit {
  private dummy = '';
  constructor(private readonly config: AuthConfig) {}
  private get parameters() {
    const v = this.config.values;
    return {
      type: argon2id,
      memoryCost: v.ARGON2_MEMORY_KIB,
      timeCost: v.ARGON2_TIME_COST,
      parallelism: v.ARGON2_PARALLELISM,
    };
  }
  async onModuleInit(): Promise<void> {
    this.dummy = await hash(randomBytes(32), this.parameters);
  }
  async verifyCredential(
    password: string,
    storedHash?: string,
  ): Promise<boolean> {
    // Always perform argon2 work for unknown accounts; never early-return on account state.
    if (!this.dummy) await this.onModuleInit();
    try {
      return await verify(storedHash ?? this.dummy, password);
    } catch {
      await verify(this.dummy, password);
      return false;
    }
  }
  async hash(password: string): Promise<string> {
    return hash(password, this.parameters);
  }
  strengthenedParameters(storedHash: string): boolean {
    const match = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(
      storedHash,
    );
    if (!match) return true;
    return (
      Number(match[1]) < this.parameters.memoryCost ||
      Number(match[2]) < this.parameters.timeCost ||
      Number(match[3]) < this.parameters.parallelism
    );
  }
  async rehash(password: string, oldHash: string): Promise<string> {
    // Never lower any existing work factor when increasing another.
    const m = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(oldHash);
    return hash(password, {
      ...this.parameters,
      memoryCost: Math.max(this.parameters.memoryCost, Number(m?.[1] ?? 0)),
      timeCost: Math.max(this.parameters.timeCost, Number(m?.[2] ?? 0)),
      parallelism: Math.max(this.parameters.parallelism, Number(m?.[3] ?? 0)),
    });
  }
  assertAllowed(
    value: string,
    username: string,
    currentPassword: string,
  ): void {
    if (
      !passwordAllowed(
        value,
        username,
        this.config.values.PASSWORD_MIN_LENGTH,
        currentPassword,
      )
    )
      throw new AuthError('PASSWORD_POLICY', 400);
  }
}
