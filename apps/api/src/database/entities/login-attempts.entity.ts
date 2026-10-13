import { Entity, Index, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('login_attempts')
@Index('ix_login_attempts_0', ['usernameAttempted', 'attemptedAt'], {
  unique: false,
})
@Index('ix_login_attempts_1', ['ipAddress', 'attemptedAt'], { unique: false })
export class LoginAttempt {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({
    type: 'nvarchar',
    length: 100,
    collation: 'Latin1_General_100_CI_AS',
  })
  usernameAttempted!: string;

  @Column({ type: 'varchar', length: 45 })
  ipAddress!: string;

  @Column({ type: 'bit', default: () => '0' })
  success!: boolean;

  @Column({
    type: 'datetime2',
    precision: 3,
    default: () => 'SYSUTCDATETIME()',
  })
  attemptedAt!: Date;

  @Column({ type: 'nvarchar', length: 160, nullable: true })
  failureReason!: string | null;
}
