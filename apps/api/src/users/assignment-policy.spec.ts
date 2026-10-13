import { validateAssignments } from './assignment-policy';
describe('role assignment policy', () => {
  it.each([
    ['ALL', [], [], true],
    ['ALL', [1], [], false],
    ['ALL', [], [1], false],
    ['CENTER', [], [], false],
    ['CENTER', [1], [], true],
    ['CENTER', [1], [1], false],
    ['CLUSTER', [], [], false],
    ['CLUSTER', [1], [], false],
    ['CLUSTER', [], [1], true],
    ['CLUSTER', [2], [1], true],
    ['ASSIGNED', [], [], false],
    ['ASSIGNED', [1], [], true],
    ['ASSIGNED', [], [1], true],
    ['ASSIGNED', [1], [2], true],
  ] as [string, number[], number[], boolean][])(
    '%s with centers %j and clusters %j valid=%s',
    (type, centers, clusters, valid) => {
      if (valid)
        expect(() =>
          validateAssignments(type, centers, clusters),
        ).not.toThrow();
      else expect(() => validateAssignments(type, centers, clusters)).toThrow();
    },
  );
});
