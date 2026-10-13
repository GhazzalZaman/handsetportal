import { AdminError } from '../admin/admin.error';
export function validateAssignments(
  type: string,
  centers: number[],
  clusters: number[],
) {
  if (type === 'ALL' && (centers.length || clusters.length))
    throw new AdminError('ALL_ASSIGNMENTS_FORBIDDEN');
  if (type === 'CENTER' && (!centers.length || clusters.length))
    throw new AdminError('CENTER_ASSIGNMENTS_REQUIRED');
  if (type === 'CLUSTER' && !clusters.length)
    throw new AdminError('CLUSTER_ASSIGNMENTS_REQUIRED');
  if (type === 'ASSIGNED' && !centers.length && !clusters.length)
    throw new AdminError('ASSIGNMENTS_REQUIRED');
  if (!['ALL', 'CENTER', 'CLUSTER', 'ASSIGNED'].includes(type))
    throw new AdminError('INVALID_ROLE');
}
