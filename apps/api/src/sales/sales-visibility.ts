import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
export function applySalesVisibility<T extends ObjectLiteral>(
  query: SelectQueryBuilder<T>,
  alias: string,
  includeVoided = false,
) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(alias))
    throw Error('Invalid sales alias');
  return includeVoided ? query : query.andWhere(alias + '.voidedAt IS NULL');
}
