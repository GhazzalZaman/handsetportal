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
import { ExperienceCenter } from './experience-centers.entity';
import { HandsetSku } from './handset-skus.entity';
import { User } from './users.entity';

@Entity('inventory_stock')
@Unique('uq_inventory_stock_0', ['centerId', 'skuId'])
@Check('ck_inventory_stock_0', '[quantity_available] >= 0')
@Check(
  'ck_inventory_stock_threshold',
  '[low_stock_threshold] IS NULL OR [low_stock_threshold] >= 0',
)
@Index('ix_inventory_stock_0', ['skuId'], { unique: false })
@ForeignKey(() => ExperienceCenter, ['centerId'], ['id'], {
  name: 'fk_inventory_stock_0',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => HandsetSku, ['skuId'], ['id'], {
  name: 'fk_inventory_stock_1',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => User, ['createdBy'], ['id'], {
  name: 'fk_inventory_stock_2',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => User, ['updatedBy'], ['id'], {
  name: 'fk_inventory_stock_3',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
export class InventoryStock {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'int' })
  centerId!: number;

  @Column({ type: 'int' })
  skuId!: number;

  @Column({ type: 'int', default: () => '0' })
  quantityAvailable!: number;

  @Column({ type: 'int', nullable: true })
  lowStockThreshold!: number | null;

  @Column({
    type: 'datetime2',
    precision: 3,
    default: () => 'SYSUTCDATETIME()',
  })
  lastStockUpdateAt!: Date;

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
