import {
  Entity,
  Unique,
  ForeignKey,
  PrimaryGeneratedColumn,
  Column,
  VersionColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './users.entity';

@Entity('permissions')
@Unique('uq_permissions_0', ['code'])
@ForeignKey(() => User, ['createdBy'], ['id'], {
  name: 'fk_permissions_0',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => User, ['updatedBy'], ['id'], {
  name: 'fk_permissions_1',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
export class Permission {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Column({
    type: 'varchar',
    length: 80,
    collation: 'Latin1_General_100_CI_AS',
  })
  code!: string;

  @Column({ type: 'nvarchar', length: 255 })
  description!: string;

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
