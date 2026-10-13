import {
  Entity,
  Index,
  ForeignKey,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
} from 'typeorm';
import { User } from './users.entity';
import { Cluster } from './clusters.entity';

@Entity('user_cluster_assignments')
@Index('ix_user_cluster_assignments_0', ['clusterId'], { unique: false })
@ForeignKey(() => User, ['userId'], ['id'], {
  name: 'fk_user_cluster_assignments_0',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => Cluster, ['clusterId'], ['id'], {
  name: 'fk_user_cluster_assignments_1',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => User, ['createdBy'], ['id'], {
  name: 'fk_user_cluster_assignments_2',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => User, ['updatedBy'], ['id'], {
  name: 'fk_user_cluster_assignments_3',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
export class UserClusterAssignment {
  @PrimaryColumn({ type: 'int' })
  userId!: number;

  @PrimaryColumn({ type: 'int' })
  clusterId!: number;

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
