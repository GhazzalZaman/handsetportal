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
import { HandsetModel } from './handset-models.entity';
import { User } from './users.entity';

@Entity('model_specifications')
@Unique('uq_model_specifications_name_key', ['modelId', 'nameKey'])
@Unique('uq_model_specifications_0', ['modelId', 'label'])
@Unique('uq_model_specifications_1', ['id', 'modelId'])
@Check('ck_model_specifications_0', '[ram_gb] IS NULL OR [ram_gb] > 0')
@Check('ck_model_specifications_1', '[storage_gb] IS NULL OR [storage_gb] > 0')
@ForeignKey(() => HandsetModel, ['modelId'], ['id'], {
  name: 'fk_model_specifications_0',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => User, ['createdBy'], ['id'], {
  name: 'fk_model_specifications_1',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => User, ['updatedBy'], ['id'], {
  name: 'fk_model_specifications_2',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
export class ModelSpecification {
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
  modelId!: number;

  @Column({
    type: 'nvarchar',
    length: 100,
    collation: 'Latin1_General_100_CI_AS',
  })
  label!: string;

  @Column({ type: 'int', nullable: true })
  ramGb!: number | null;

  @Column({ type: 'int', nullable: true })
  storageGb!: number | null;

  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  notes!: string | null;

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
