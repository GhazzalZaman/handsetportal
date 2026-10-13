import {
  Entity,
  Unique,
  Index,
  ForeignKey,
  PrimaryGeneratedColumn,
  Column,
  VersionColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Cluster } from './clusters.entity';
import { User } from './users.entity';

@Entity('experience_centers')
@Unique('uq_experience_centers_0', ['code'])
@Unique('uq_experience_centers_1', ['name'])
@Index('ix_experience_centers_0', ['clusterId'], { unique: false })
@ForeignKey(() => Cluster, ['clusterId'], ['id'], {
  name: 'fk_experience_centers_0',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => User, ['createdBy'], ['id'], {
  name: 'fk_experience_centers_1',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => User, ['updatedBy'], ['id'], {
  name: 'fk_experience_centers_2',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
export class ExperienceCenter {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Column({
    type: 'varchar',
    length: 40,
    collation: 'Latin1_General_100_CI_AS',
  })
  code!: string;

  @Column({
    type: 'nvarchar',
    length: 160,
    collation: 'Latin1_General_100_CI_AS',
  })
  name!: string;

  @Column({ type: 'nvarchar', length: 60, nullable: true })
  shortName!: string | null;

  @Column({ type: 'int', nullable: true })
  clusterId!: number | null;

  @Column({ type: 'bit', default: () => '1' })
  isActive!: boolean;

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
