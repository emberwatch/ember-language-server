import { SymbolInformation, SymbolKind } from 'vscode-languageserver';
const { preprocess, traverse } = require('@glimmer/syntax');

import DocumentSymbolProvider from './document-symbol-provider';
import { toLSRange } from '../estree-utils';

export default class HBSDocumentSymbolProvider implements DocumentSymbolProvider {
  extensions: string[] = ['.hbs'];

  process(content: string): SymbolInformation[] {
    let ast = preprocess(content);

    let symbols: SymbolInformation[] = [];

    traverse(ast, {
      ElementNode(node: any) {
        if (node.tag.charAt(0) === node.tag.charAt(0).toUpperCase()) {
          symbols.push(SymbolInformation.create(node.tag, SymbolKind.Variable, toLSRange(node.loc)));
        }
      },
      BlockStatement(node: any) {
        if (node.hash.pairs.length) {
          node.hash.pairs.filter((el: any ) => el.type === 'HashPair').forEach((pair: any) => {
            symbols.push(SymbolInformation.create(pair.key, SymbolKind.Property, toLSRange(pair.loc)));
          });
        }

        if (node.program.blockParams.length === 0) return;

        node.program.blockParams.forEach((blockParam: string) => {
          let symbol = SymbolInformation.create(blockParam, SymbolKind.Variable, toLSRange(node.loc));
          symbols.push(symbol);
        });
      },
      MustacheStatement(node: any) {
        if (node.hash.pairs.length) {
          node.hash.pairs.filter((el: any ) => el.type === 'HashPair').forEach((pair: any) => {
            symbols.push(SymbolInformation.create(pair.key, SymbolKind.Property, toLSRange(pair.loc)));
          });
        }
        if (node.path.type === 'PathExpression') {
          if (node.path.data) {
            let symbol = SymbolInformation.create(node.path.original, SymbolKind.Variable, toLSRange(node.path.loc));
            symbols.push(symbol);
          }
        }
      }
    });

    return symbols;
  }
}
