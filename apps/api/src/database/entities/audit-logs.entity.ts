import {
  Entity,
  Check,
  Index,
  ForeignKey,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';
import { User } from './users.entity';

// Append-only: the runtime database principal must have no UPDATE or DELETE permission.
@Entity('audit_logs')
@Check('ck_audit_logs_0', "[action] IN ('CREATE','UPDATE','DELETE')")
@Check('ck_audit_logs_1', "[action] <> 'UPDATE' OR [field_name] IS NOT NULL")
@Index('ix_audit_logs_0', ['entityType', 'entityId', 'changedAt'], {
  unique: false,
})
@Index('ix_audit_logs_1', ['userId', 'changedAt'], { unique: false })
@ForeignKey(() => User, ['userId'], ['id'], {
  name: 'fk_audit_logs_0',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
export class AuditLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  entityType!: string;

  @Column({ type: 'varchar', length: 100 })
  entityId!: string;

  @Column({ type: 'varchar', length: 10 })
  action!: string;

  @Column({ type: 'nvarchar', length: 100, nullable: true })
  fieldName!: string | null;

  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  oldValue!: string | null;

  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  newValue!: string | null;

  @Column({ type: 'int', nullable: true })
  userId!: number | null;

  @Column({
    type: 'datetime2',
    precision: 3,
    default: () => 'SYSUTCDATETIME()',
  })
  changedAt!: Date;

  @Column({ type: 'varchar', length: 64 })
  requestId!: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress!: string | null;
}
