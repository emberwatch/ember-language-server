import { extname } from 'path';
import { TextDocumentIdentifier } from 'vscode-languageserver';
import { uriToFilePath } from 'vscode-languageserver/lib/files';

export function getExtension(textDocument: TextDocumentIdentifier): string {
  const filePath = uriToFilePath(textDocument.uri);
  const ext = filePath ? extname(filePath) : '';

  return ext === '.handlebars' ? '.hbs' : ext;
}

export function hasExtension(textDocument: TextDocumentIdentifier, ...extensions: string[]): boolean {
  return extensions.includes(getExtension(textDocument));
}
