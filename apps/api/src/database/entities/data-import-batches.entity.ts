import {
  Entity,
  Check,
  Index,
  ForeignKey,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './users.entity';

@Entity('data_import_batches')
@Check('ck_data_import_batches_0', "[kind] IN ('SALES','INVENTORY','MASTER')")
@Check(
  'ck_data_import_batches_1',
  "[status] IN ('RUNNING','SUCCESS','PARTIAL','FAILED')",
)
@Check(
  'ck_data_import_batches_2',
  '[rows_received] >= 0 AND [rows_accepted] >= 0 AND [rows_rejected] >= 0 AND [rows_accepted] + [rows_rejected] <= [rows_received]',
)
@Check(
  'ck_data_import_batches_3',
  '[finished_at] IS NULL OR [finished_at] >= [started_at]',
)
@Index('ix_data_import_batches_0', ['kind', 'status', 'finishedAt'], {
  unique: false,
})
@ForeignKey(() => User, ['triggeredBy'], ['id'], {
  name: 'fk_data_import_batches_0',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => User, ['createdBy'], ['id'], {
  name: 'fk_data_import_batches_1',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => User, ['updatedBy'], ['id'], {
  name: 'fk_data_import_batches_2',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
export class DataImportBatch {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: 40 })
  sourceSystem!: string;

  @Column({ type: 'varchar', length: 20 })
  kind!: string;

  @Column({ type: 'nvarchar', length: 255, nullable: true })
  fileName!: string | null;

  @Column({
    type: 'datetime2',
    precision: 3,
    default: () => 'SYSUTCDATETIME()',
  })
  startedAt!: Date;

  @Column({ type: 'datetime2', precision: 3, nullable: true })
  finishedAt!: Date | null;

  @Column({ type: 'varchar', length: 20, default: () => "'RUNNING'" })
  status!: string;

  @Column({ type: 'int', default: () => '0' })
  rowsReceived!: number;

  @Column({ type: 'int', default: () => '0' })
  rowsAccepted!: number;

  @Column({ type: 'int', default: () => '0' })
  rowsRejected!: number;

  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  errorSummary!: string | null;

  @Column({ type: 'int', nullable: true })
  triggeredBy!: number | null;

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
