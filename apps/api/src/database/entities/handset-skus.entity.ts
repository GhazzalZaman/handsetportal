import {
  Entity,
  Unique,
  Index,
  ForeignKey,
  PrimaryGeneratedColumn,
  Column,
  Check,
  VersionColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { HandsetModel } from './handset-models.entity';
import { ModelSpecification } from './model-specifications.entity';
import { Color } from './colors.entity';
import { User } from './users.entity';

@Entity('handset_skus')
@Check(
  'ck_handset_skus_list_price',
  '[list_price] IS NULL OR [list_price] >= 0',
)
@Unique('uq_handset_skus_0', ['skuCode'])
@Index('ix_handset_skus_0', ['modelId', 'specificationId', 'colorId'], {
  unique: true,
  where: '[specification_id] IS NOT NULL',
})
@Index('ix_handset_skus_1', ['modelId', 'colorId'], {
  unique: true,
  where: '[specification_id] IS NULL',
})
@Index('ix_handset_skus_2', ['colorId'], { unique: false })
@ForeignKey(() => HandsetModel, ['modelId'], ['id'], {
  name: 'fk_handset_skus_0',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(
  () => ModelSpecification,
  ['specificationId', 'modelId'],
  ['id', 'modelId'],
  { name: 'fk_handset_skus_1', onDelete: 'NO ACTION', onUpdate: 'NO ACTION' },
)
@ForeignKey(() => Color, ['colorId'], ['id'], {
  name: 'fk_handset_skus_2',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => User, ['createdBy'], ['id'], {
  name: 'fk_handset_skus_3',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => User, ['updatedBy'], ['id'], {
  name: 'fk_handset_skus_4',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
export class HandsetSku {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'int' })
  modelId!: number;

  @Column({ type: 'int', nullable: true })
  specificationId!: number | null;

  @Column({ type: 'int' })
  colorId!: number;

  @Column({
    type: 'varchar',
    length: 100,
    collation: 'Latin1_General_100_CI_AS',
  })
  skuCode!: string;

  @Column({
    name: 'list_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: string | null) => value,
      from: (value: number | string | null) =>
        value == null ? null : Number(value).toFixed(2),
    },
  })
  listPrice!: string | null;

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
