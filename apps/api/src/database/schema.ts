/** Restrict dynamic identifiers; values must always use parameters/query builders. */
export function databaseSchema(value: unknown): string {
  const schema = value === undefined ? 'dbo' : value;
  if (
    typeof schema !== 'string' ||
    !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(schema)
  )
    throw new Error('Invalid DB_SCHEMA');
  return schema;
}
