import { describe, expect, it } from 'vitest';
import {
  startOfPktDay,
  startOfPktMonth,
  startOfPktYear,
  previousPktDay,
} from './pkt-date';
describe('PKT boundaries', () => {
  it.each([
    ['2026-10-06T18:59:59Z', '2026-10-05T19:00:00.000Z'],
    ['2026-10-06T19:00:00Z', '2026-10-06T19:00:00.000Z'],
    ['2024-02-29T20:00:00Z', '2024-02-29T19:00:00.000Z'],
  ])('day containing %s', (input, expected) =>
    expect(startOfPktDay(new Date(input)).toISOString()).toBe(expected),
  );
  it('uses the PKT month and year across UTC rollover', () => {
    const d = new Date('2025-12-31T20:00:00Z');
    expect(startOfPktMonth(d).toISOString()).toBe('2025-12-31T19:00:00.000Z');
    expect(startOfPktYear(d).toISOString()).toBe('2025-12-31T19:00:00.000Z');
    expect(d.toISOString()).toBe('2025-12-31T20:00:00.000Z');
  });
  it('returns leap-day Day-1 bounds', () => {
    const range = previousPktDay(new Date('2024-03-01T05:00:00Z'));
    expect(range.start.toISOString()).toBe('2024-02-28T19:00:00.000Z');
    expect(range.end.toISOString()).toBe('2024-02-29T19:00:00.000Z');
  });
  it.each([startOfPktDay, startOfPktMonth, startOfPktYear])(
    'rejects invalid dates',
    (fn) => expect(() => fn(new Date(NaN))).toThrow('Invalid date'),
  );
});
