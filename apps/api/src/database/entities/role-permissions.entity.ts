import {
  Entity,
  Index,
  ForeignKey,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
} from 'typeorm';
import { Role } from './roles.entity';
import { Permission } from './permissions.entity';
import { User } from './users.entity';

@Entity('role_permissions')
@Index('ix_role_permissions_0', ['permissionId'], { unique: false })
@ForeignKey(() => Role, ['roleId'], ['id'], {
  name: 'fk_role_permissions_0',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => Permission, ['permissionId'], ['id'], {
  name: 'fk_role_permissions_1',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => User, ['createdBy'], ['id'], {
  name: 'fk_role_permissions_2',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
@ForeignKey(() => User, ['updatedBy'], ['id'], {
  name: 'fk_role_permissions_3',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
})
export class RolePermission {
  @PrimaryColumn({ type: 'int' })
  roleId!: number;

  @PrimaryColumn({ type: 'int' })
  permissionId!: number;

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
