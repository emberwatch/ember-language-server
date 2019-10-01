import { DiagnosticSeverity } from 'vscode-languageserver';
import { toDiagnostic } from '../../src/utils/diagnostic';

describe('diagnostic-utils', function() {
  describe('toDiagnostic()', function() {
    it('converts handlebars parser errors', function() {
      const { source, error } = require('./../fixtures/dignostic/handlbars-parser-error.json');

      const diagnostic = toDiagnostic(source, error);

      expect(diagnostic.range.start.line).toEqual(1);
      expect(diagnostic.range.start.character).toEqual(2);
      expect(diagnostic.range.end.line).toEqual(1);
      expect(diagnostic.range.end.character).toEqual(6);
      expect(diagnostic.severity).toEqual(DiagnosticSeverity.Error);
      expect(diagnostic.message).toEqual('Expecting \'ID\', \'STRING\', \'NUMBER\', \'BOOLEAN\', \'UNDEFINED\', \'NULL\', \'DATA\', got \'CLOSE\'');
      expect(diagnostic.source).toEqual('glimmer-engine');
    });

    it('converts glimmer compiler errors', function() {
      const { source, error } = require('./../fixtures/dignostic/glimmer-compiler-error.json');

      const diagnostic = toDiagnostic(source, error);

      expect(diagnostic.range.start.line).toEqual(1);
      expect(diagnostic.range.start.character).toEqual(2);
      expect(diagnostic.range.end.line).toEqual(1);
      expect(diagnostic.range.end.character).toEqual(11);
      expect(diagnostic.severity).toEqual(DiagnosticSeverity.Error);
      expect(diagnostic.message).toEqual('Unclosed element `div`');
      expect(diagnostic.source).toEqual('glimmer-engine');
    });

    it('converts unclosed element errors', function() {
      const { source, error } = require('./../fixtures/dignostic/non-translated-error.json');

      const diagnostic = toDiagnostic(source, error);

      expect(diagnostic.range.start.line).toEqual(1);
      expect(diagnostic.range.start.character).toEqual(6);
      expect(diagnostic.range.end.line).toEqual(1);
      expect(diagnostic.range.end.character).toEqual(17);
      expect(diagnostic.severity).toEqual(DiagnosticSeverity.Error);
      expect(diagnostic.message).toEqual('Non-translated string used');
      expect(diagnostic.source).toEqual('ember-template-lint');
    });
  });
});
