import {
  Entity,
  Unique,
  Check,
  ForeignKey,
  PrimaryGeneratedColumn,
  Column,
  VersionColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './users.entity';

@Entity('roles')
@Unique('uq_roles_0', ['code'])
@Check('ck_roles_0', "[scope_type] IN ('ALL','CLUSTER','CENTER','ASSIGNED')")
@ForeignKey(() => User, ['createdBy'], ['id'], {
  name: 'fk_roles_0',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => User, ['updatedBy'], ['id'], {
  name: 'fk_roles_1',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
export class Role {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Column({
    type: 'varchar',
    length: 60,
    collation: 'Latin1_General_100_CI_AS',
  })
  code!: string;

  @Column({ type: 'nvarchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 10 })
  scopeType!: string;

  @Column({ type: 'bit', default: () => '0' })
  canEditDefault!: boolean;

  @Column({ type: 'bit', default: () => '1' })
  isActive!: boolean;

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
