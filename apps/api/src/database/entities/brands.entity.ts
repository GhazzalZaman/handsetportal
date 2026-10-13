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

@Entity('brands')
@Unique('uq_brands_name_key', ['nameKey'])
@Unique('uq_brands_0', ['name'])
@ForeignKey(() => User, ['createdBy'], ['id'], {
  name: 'fk_brands_0',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => User, ['updatedBy'], ['id'], {
  name: 'fk_brands_1',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
export class Brand {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Column({
    type: 'nvarchar',
    length: 200,
    select: false,
    collation: 'Latin1_General_100_BIN2',
  })
  nameKey!: string;

  @Column({
    type: 'nvarchar',
    length: 100,
    collation: 'Latin1_General_100_CI_AS',
  })
  name!: string;

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
