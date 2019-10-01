import { getExtension, hasExtension } from '../../src/utils/file-extension';

describe('file-extension-utils', function() {

  describe('getExtension()', function() {
    it('return right extensions', function() {
      expect(getExtension({ uri: 'file:///project/app.js' })).toEqual('.js');
      expect(getExtension({ uri: 'file:///project/application.hbs' })).toEqual('.hbs');
      expect(getExtension({ uri: 'file:///project/application.handlebars' })).toEqual('.hbs');
      expect(getExtension({ uri: 'file:///project/application.css' })).toEqual('.css');
    });
  });

  describe('hasExtension()', function() {
    it('checks file has one of the provides extensions', function() {
      expect(hasExtension({ uri: 'file:///project/app/app.js' }, '.js', '.hbs')).toBeTruthy();
      expect(hasExtension({ uri: 'file:///project/app/application.hbs' }, '.js', '.hbs')).toBeTruthy();
      expect(hasExtension({ uri: 'file:///project/app/application.handlebars' }, '.js', '.hbs')).toBeTruthy();
      expect(hasExtension({ uri: 'file:///project/app/application.css' }, '.hbs')).toBeFalsy();
    });
  });
});
