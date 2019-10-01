import uniqueBy from '../../src/utils/unique-by';

describe('unique-by', function() {
  it('should filter out objects with the same primitive value of a given property', function() {
    const arr = [{ foo: 1 }, { foo: 2}, { foo: 2 }];

    expect(uniqueBy(arr, 'foo')).toEqual([{ foo: 1 }, { foo: 2}]);
  });

  it('should filter out objects with same the object value of a given property', function() {
    const child = {};
    const arr = [{ foo: child }, { foo: child }];

    expect(uniqueBy(arr, 'foo')).toEqual([{ foo: child }]);
  });
});
