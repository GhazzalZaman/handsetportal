import {
  Entity,
  Unique,
  Check,
  Index,
  ForeignKey,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { User } from './users.entity';

@Entity('sessions')
@Unique('uq_sessions_0', ['sessionHash'])
@Check(
  'ck_sessions_0',
  "LEN([session_hash]) = 64 AND [session_hash] NOT LIKE '%[^0-9a-f]%' COLLATE Latin1_General_100_BIN2",
)
@Check(
  'ck_sessions_1',
  '[idle_expires_at] <= [absolute_expires_at] AND [created_at] <= [last_seen_at] AND [last_seen_at] <= [idle_expires_at]',
)
@Check('ck_sessions_2', '[revoked_at] IS NULL OR [revoked_at] >= [created_at]')
@Index('ix_sessions_0', ['userId'], { unique: false })
@Index('ix_sessions_1', ['idleExpiresAt'], { unique: false })
@Index('ix_sessions_2', ['absoluteExpiresAt'], { unique: false })
@ForeignKey(() => User, ['userId'], ['id'], {
  name: 'fk_sessions_0',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
export class Session {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({
    type: 'char',
    length: 64,
    collation: 'Latin1_General_100_BIN2',
    select: false,
  })
  sessionHash!: string;

  @Column({ type: 'char', length: 64, nullable: true, select: false })
  authorizationHash!: string | null;

  @Column({ type: 'int' })
  userId!: number;

  @CreateDateColumn({
    type: 'datetime2',
    precision: 3,
    default: () => 'SYSUTCDATETIME()',
  })
  createdAt!: Date;

  @Column({
    type: 'datetime2',
    precision: 3,
    default: () => 'SYSUTCDATETIME()',
  })
  lastSeenAt!: Date;

  @Column({ type: 'datetime2', precision: 3 })
  idleExpiresAt!: Date;

  @Column({ type: 'datetime2', precision: 3 })
  absoluteExpiresAt!: Date;

  @Column({ type: 'datetime2', precision: 3, nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'nvarchar', length: 160, nullable: true })
  revokedReason!: string | null;

  @Column({ type: 'varchar', length: 45 })
  ipAddress!: string;

  @Column({ type: 'nvarchar', length: 512 })
  userAgent!: string;
}
