import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  Check,
  ForeignKey,
} from 'typeorm';
import { ExperienceCenter } from './experience-centers.entity';
import { HandsetSku } from './handset-skus.entity';
import { SalesTransaction } from './sales-transactions.entity';
import { User } from './users.entity';
@Entity('inventory_movements')
@Index('ix_movements_pair', ['centerId', 'skuId', 'id'])
@Check('ck_movements_quantity', '[quantity_after] >= 0')
@Check(
  'ck_movements_type',
  "[movement_type] IN ('OPENING','RECEIPT','SALE','SALE_REVERSAL','ADJUSTMENT')",
)
@Check(
  'ck_movements_received',
  "[received_from] IS NULL OR [received_from] IN ('WAREHOUSE','EXPERIENCE_CENTER')",
)
@ForeignKey(() => ExperienceCenter, ['centerId'], ['id'], {
  name: 'fk_movements_center',
})
@ForeignKey(() => ExperienceCenter, ['sourceCenterId'], ['id'], {
  name: 'fk_movements_source',
})
@ForeignKey(() => HandsetSku, ['skuId'], ['id'], { name: 'fk_movements_sku' })
@ForeignKey(() => SalesTransaction, ['salesTransactionId'], ['id'], {
  name: 'fk_movements_sale',
})
@ForeignKey(() => User, ['userId'], ['id'], { name: 'fk_movements_user' })
export class InventoryMovement {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ type: 'int' }) centerId!: number;
  @Column({ type: 'int' }) skuId!: number;
  @Column({ type: 'varchar', length: 20 }) movementType!: string;
  @Column({ type: 'int' }) quantityDelta!: number;
  @Column({ type: 'int' }) quantityAfter!: number;
  @Column({ type: 'varchar', length: 40, nullable: true }) reasonCode!:
    string | null;
  @Column({ type: 'nvarchar', length: 1000, nullable: true }) note!:
    string | null;
  @Column({ type: 'bigint', nullable: true }) salesTransactionId!:
    string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) receivedFrom!:
    string | null;
  @Column({ type: 'int', nullable: true }) sourceCenterId!: number | null;
  @Column({ type: 'nvarchar', length: 160, nullable: true }) reference!:
    string | null;
  @Column({ type: 'int', nullable: true }) userId!: number | null;
  @CreateDateColumn({
    type: 'datetime2',
    precision: 3,
    default: () => 'SYSUTCDATETIME()',
  })
  createdAt!: Date;
  @Column({ type: 'varchar', length: 100 }) requestId!: string;
}
