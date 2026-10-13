import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Cluster, ExperienceCenter } from '../database/entities';
import { CenterScope } from '../scope/scope.service';
import { PageDto, pageResult } from '../admin/admin.dto';
@Injectable()
export class DirectoryRepository {
  constructor(private readonly db: DataSource) {}
  async centers(scope: CenterScope, dto: PageDto) {
    const q = this.db
      .getRepository(ExperienceCenter)
      .createQueryBuilder('center');
    scope.applyToQuery(q, 'center.id');
    const [rows, total] = await q
      .orderBy('center.id', 'ASC')
      .skip((dto.page - 1) * dto.pageSize)
      .take(dto.pageSize)
      .getManyAndCount();
    const items = await Promise.all(
      rows.map(async (c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        shortName: c.shortName,
        clusterId: c.clusterId,
        isActive: c.isActive,
        cluster: c.clusterId
          ? await this.db.getRepository(Cluster).findOne({
              where: { id: c.clusterId },
              select: { id: true, code: true, name: true, isActive: true },
            })
          : null,
      })),
    );
    return pageResult(items, total, dto);
  }
  async clusters(scope: CenterScope, dto: PageDto, catalog = false) {
    const q = this.db.getRepository(Cluster).createQueryBuilder('cluster');
    if (!catalog) {
      const centers = this.db
        .getRepository(ExperienceCenter)
        .createQueryBuilder('center')
        .select('center.clusterId');
      scope.applyToQuery(centers, 'center.id');
      q.where(
        'cluster.id IN (' + centers.getQuery() + ')',
        centers.getParameters(),
      );
    }
    const [rows, total] = await q
      .orderBy('cluster.id', 'ASC')
      .skip((dto.page - 1) * dto.pageSize)
      .take(dto.pageSize)
      .getManyAndCount();
    return pageResult(
      rows.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        isActive: c.isActive,
      })),
      total,
      dto,
    );
  }
}
