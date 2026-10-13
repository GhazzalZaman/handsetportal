export function formatListPrice(value: string | number | null | undefined) {
  return value == null
    ? 'Not set'
    : 'Rs ' +
        new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(
          Number(value),
        );
}
