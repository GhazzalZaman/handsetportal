import {
  Entity,
  Unique,
  Check,
  Index,
  ForeignKey,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ExperienceCenter } from './experience-centers.entity';
import { HandsetSku } from './handset-skus.entity';
import { DataImportBatch } from './data-import-batches.entity';
import { User } from './users.entity';

@Entity('sales_transactions')
@Index('uq_sales_client_request', ['clientRequestId'], {
  unique: true,
  where: '[client_request_id] IS NOT NULL',
})
@ForeignKey(() => User, ['recordedBy'], ['id'], {
  name: 'fk_sales_recorder',
  onDelete: 'NO ACTION',
})
@ForeignKey(() => User, ['voidedBy'], ['id'], {
  name: 'fk_sales_voider',
  onDelete: 'NO ACTION',
})
@Unique('uq_sales_transactions_0', ['sourceSystem', 'externalRef'])
@Check('ck_sales_transactions_0', '[quantity] > 0')
@Check(
  'ck_sales_transactions_1',
  "[sales_type] IN ('CASH','INSTALLMENT','FNF')",
)
@Check(
  'ck_sales_transactions_2',
  "[dispatch_source] IN ('WAREHOUSE','EXPERIENCE_CENTER')",
)
@Check(
  'ck_sales_transactions_3',
  '[sale_date] = CONVERT(date, DATEADD(minute, 300, [sold_at]))',
)
@Index('ix_sales_transactions_0', ['centerId', 'saleDate'], { unique: false })
@Index('ix_sales_transactions_1', ['skuId', 'saleDate'], { unique: false })
@Index('ix_sales_transactions_2', { synchronize: false })
@Index('ix_sales_transactions_3', ['importBatchId'], { unique: false })
@ForeignKey(() => ExperienceCenter, ['centerId'], ['id'], {
  name: 'fk_sales_transactions_0',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => HandsetSku, ['skuId'], ['id'], {
  name: 'fk_sales_transactions_1',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => DataImportBatch, ['importBatchId'], ['id'], {
  name: 'fk_sales_transactions_2',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => User, ['createdBy'], ['id'], {
  name: 'fk_sales_transactions_3',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => User, ['updatedBy'], ['id'], {
  name: 'fk_sales_transactions_4',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
export class SalesTransaction {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'int', nullable: true }) recordedBy!: number | null;
  @Column({ type: 'nvarchar', length: 1000, nullable: true }) notes!:
    string | null;
  @Column({ type: 'uniqueidentifier', nullable: true }) clientRequestId!:
    string | null;
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  listPriceSnapshot!: string | null;
  @Column({ type: 'datetime2', precision: 3, nullable: true })
  voidedAt!: Date | null;
  @Column({ type: 'int', nullable: true }) voidedBy!: number | null;
  @Column({ type: 'nvarchar', length: 500, nullable: true }) voidReason!:
    string | null;

  @Column({ type: 'int' })
  centerId!: number;

  @Column({ type: 'int' })
  skuId!: number;

  @Column({ type: 'datetime2', precision: 3 })
  soldAt!: Date;

  @Column({ type: 'date' })
  saleDate!: string;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({ type: 'varchar', length: 20 })
  salesType!: string;

  @Column({ type: 'varchar', length: 30 })
  dispatchSource!: string;

  @Column({
    type: 'varchar',
    length: 40,
    collation: 'Latin1_General_100_CI_AS',
  })
  sourceSystem!: string;

  @Column({
    type: 'varchar',
    length: 160,
    collation: 'Latin1_General_100_CI_AS',
  })
  externalRef!: string;

  @Column({ type: 'bigint', nullable: true })
  importBatchId!: string | null;

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
