import { CenterScope } from './scope.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
describe('center access assertions', () => {
  it('requires both scope membership and edit permission', () => {
    expect(() =>
      new CenterScope(false, [1], ['inventory.adjust']).assertCanEditCenter(1),
    ).not.toThrow();
    expect(() =>
      new CenterScope(true, [1], ['inventory.adjust']).assertCanEditCenter(2),
    ).toThrow(ForbiddenException);
    expect(() =>
      new CenterScope(false, [1], []).assertCanEditCenter(1),
    ).toThrow(ForbiddenException);
  });
  it('uses 404 for a resource lookup and 403 for explicit center selection', () => {
    const scope = new CenterScope(false, [], []);
    expect(() => scope.assertCanAccessCenter(1, true)).toThrow(
      NotFoundException,
    );
    expect(() => scope.assertCanAccessCenter(1)).toThrow(ForbiddenException);
  });
});
