import { getFirstTextPostion } from '../../src/utils/definition-helpers';

describe('definition-helpers', function() {

  describe('getFirstTextPostion()', function() {
    it('return crrect position for different text files', function() {
      expect(getFirstTextPostion(['', ' fooBar ', ''].join('\n'), 'foo')).toEqual([0, 0]);
      expect(getFirstTextPostion(['', ' ffooBar ', ''].join('\n'), 'foo')).toEqual([0, 0]);
      expect(getFirstTextPostion(['', ' foo() ', ''].join('\n'), 'foo')).toEqual([1, 1]);
      expect(getFirstTextPostion(['', ' foo ', ''].join('\n'), 'foo')).toEqual([1, 1]);
    });
  });

});
