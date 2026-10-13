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
import { Brand } from './brands.entity';
import { User } from './users.entity';

@Entity('handset_models')
@Unique('uq_handset_models_name_key', ['brandId', 'nameKey'])
@Unique('uq_handset_models_0', ['brandId', 'name'])
@ForeignKey(() => Brand, ['brandId'], ['id'], {
  name: 'fk_handset_models_0',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => User, ['createdBy'], ['id'], {
  name: 'fk_handset_models_1',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => User, ['updatedBy'], ['id'], {
  name: 'fk_handset_models_2',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
export class HandsetModel {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Column({
    type: 'nvarchar',
    length: 200,
    select: false,
    collation: 'Latin1_General_100_BIN2',
  })
  nameKey!: string;

  @Column({ type: 'int' })
  brandId!: number;

  @Column({
    type: 'nvarchar',
    length: 120,
    collation: 'Latin1_General_100_CI_AS',
  })
  name!: string;

  @Column({ type: 'bit', default: () => '1' })
  isActive!: boolean;

  @Column({ type: 'varchar', length: 40, nullable: true })
  sourceSystem!: string | null;

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
