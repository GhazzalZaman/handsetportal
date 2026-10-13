import { saleTime } from './sales-time';
describe('sale time in the PKT calendar', () => {
  it('assigns a new PKT month at 19:00 UTC', () => {
    expect(
      saleTime(new Date('2026-01-31T19:00:00Z'), undefined, undefined, false, 3)
        .saleDate,
    ).toBe('2026-02-01');
    expect(
      saleTime(new Date('2026-01-31T18:59:59Z'), undefined, undefined, false, 3)
        .saleDate,
    ).toBe('2026-01-31');
  });
  it('allows the full configured PKT backdate days across a month boundary', () => {
    const now = new Date('2026-03-01T19:30:00Z');
    expect(
      saleTime(now, '2026-02-26T19:00:00Z', 'Missed entry', true, 3).saleDate,
    ).toBe('2026-02-27');
    expect(() =>
      saleTime(now, '2026-02-26T18:59:59Z', 'Missed entry', true, 3),
    ).toThrow();
  });
  it('rejects future times, missing reasons, and missing permission', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    expect(() =>
      saleTime(now, '2026-01-01T12:00:01Z', 'Test', true, 3),
    ).toThrow();
    expect(() => saleTime(now, '2026-01-01T11:00:00Z', ' ', true, 3)).toThrow();
    expect(() =>
      saleTime(now, '2026-01-01T11:00:00Z', 'Test', false, 3),
    ).toThrow();
  });
});
