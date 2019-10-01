import { SymbolInformation, SymbolKind } from 'vscode-languageserver';
import { parseScriptFile as parse } from 'ember-meta-explorer';
import DocumentSymbolProvider from './document-symbol-provider';
import { toLSRange } from '../estree-utils';

const types = require('ast-types');

export default class JSDocumentSymbolProvider implements DocumentSymbolProvider {
  extensions: string[] = ['.js'];

  process(content: string): SymbolInformation[] {
    const ast = parse(content);

    let symbols: SymbolInformation[] = [];

    types.visit(ast, {
      visitProperty(path: any) {
        let node = path.node;

        let symbol = SymbolInformation.create(node.key.name, SymbolKind.Property, toLSRange(node.key.loc));
        symbols.push(symbol);

        this.traverse(path);
      },
    });

    return symbols;
  }
}
