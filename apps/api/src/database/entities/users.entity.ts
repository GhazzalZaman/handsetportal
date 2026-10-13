import {
  Entity,
  Unique,
  Check,
  Index,
  ForeignKey,
  PrimaryGeneratedColumn,
  Column,
  VersionColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from './roles.entity';

@Entity('users')
@Unique('uq_users_0', ['username'])
@Check('ck_users_0', '[failed_login_count] >= 0')
@Index('ix_users_0', ['email'], { unique: true, where: '[email] IS NOT NULL' })
@Index('ix_users_1', ['roleId'], { unique: false })
@ForeignKey(() => Role, ['roleId'], ['id'], {
  name: 'fk_users_0',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => User, ['createdBy'], ['id'], {
  name: 'fk_users_1',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => User, ['updatedBy'], ['id'], {
  name: 'fk_users_2',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
export class User {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Column({
    type: 'nvarchar',
    length: 100,
    collation: 'Latin1_General_100_CI_AS',
  })
  username!: string;

  @Column({
    type: 'nvarchar',
    length: 254,
    nullable: true,
    collation: 'Latin1_General_100_CI_AS',
  })
  email!: string | null;

  @Column({ type: 'nvarchar', length: 160 })
  displayName!: string;

  @Column({ type: 'varchar', length: 255, select: false })
  passwordHash!: string;

  @Column({ type: 'int' })
  roleId!: number;

  @Column({ type: 'bit', default: () => '1' })
  isActive!: boolean;

  @Column({ type: 'bit', default: () => '1' })
  mustChangePassword!: boolean;

  @Column({ type: 'int', default: () => '0' })
  failedLoginCount!: number;

  @Column({ type: 'datetime2', precision: 3, nullable: true })
  lockedUntil!: Date | null;

  @Column({ type: 'datetime2', precision: 3, nullable: true })
  lastLoginAt!: Date | null;

  @Column({
    type: 'datetime2',
    precision: 3,
    default: () => 'SYSUTCDATETIME()',
  })
  passwordChangedAt!: Date;

  @VersionColumn({ type: 'int', default: 1 })
  rowVersion!: number;

  @CreateDateColumn({
    type: 'datetime2',
    precision: 3,
    default: () => 'SYSUTCDATETIME()',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'datetime2',
    precision: 3,
    default: () => 'SYSUTCDATETIME()',
  })
  updatedAt!: Date;

  @Column({ type: 'int', nullable: true })
  createdBy!: number | null;

  @Column({ type: 'int', nullable: true })
  updatedBy!: number | null;
}
