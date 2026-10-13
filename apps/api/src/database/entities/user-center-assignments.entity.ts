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
import { ExperienceCenter } from './experience-centers.entity';

@Entity('user_center_assignments')
@Index('ix_user_center_assignments_0', ['centerId'], { unique: false })
@ForeignKey(() => User, ['userId'], ['id'], {
  name: 'fk_user_center_assignments_0',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => ExperienceCenter, ['centerId'], ['id'], {
  name: 'fk_user_center_assignments_1',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => User, ['createdBy'], ['id'], {
  name: 'fk_user_center_assignments_2',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => User, ['updatedBy'], ['id'], {
  name: 'fk_user_center_assignments_3',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
export class UserCenterAssignment {
  @PrimaryColumn({ type: 'int' })
  userId!: number;

  @PrimaryColumn({ type: 'int' })
  centerId!: number;

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
