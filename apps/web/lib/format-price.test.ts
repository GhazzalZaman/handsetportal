import { describe, it, expect } from 'vitest';
import { formatListPrice } from './format-price';
describe('PKR list prices', () => {
  it('formats informational amounts and distinguishes unset from zero', () => {
    expect(formatListPrice('12345.00')).toBe('Rs 12,345');
    expect(formatListPrice('12345.50')).toBe('Rs 12,345.5');
    expect(formatListPrice('0.00')).toBe('Rs 0');
    expect(formatListPrice(null)).toBe('Not set');
  });
});
