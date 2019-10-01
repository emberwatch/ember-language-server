import {
  RequestHandler,
  TextDocumentPositionParams,
  Definition
} from 'vscode-languageserver';

import Server from './../server';
import { getExtension } from './../utils/file-extension';
import TemplateDefinitionProvider from './template';
import ScriptDefinitionProvider from './script';

export default class DefinitionProvider {
  public template: TemplateDefinitionProvider;
  public script: ScriptDefinitionProvider;
  private server: Server;

  constructor(server: Server) {
    this.template = new TemplateDefinitionProvider(server);
    this.script = new ScriptDefinitionProvider(server);
    this.server = server;
  }

  handle(params: TextDocumentPositionParams): Definition | null {
    let uri = params.textDocument.uri;
    // this.server.setStatusText('Running');
    const project = this.server.projectRoots.projectForUri(uri);

    if (!project) {
      return null;
    }

    let extension = getExtension(params.textDocument);

    if (extension === '.hbs') {
      return this.template.handle(params, project);
    } else if (extension === '.js' || extension === '.ts') {
      return this.script.handle(params, project);
    } else {
      return null;
    }
  }

  get handler(): RequestHandler<TextDocumentPositionParams, Definition, void> {
    return this.handle.bind(this);
  }
}
