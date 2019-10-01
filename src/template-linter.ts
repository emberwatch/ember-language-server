import { Diagnostic, Files, TextDocument } from 'vscode-languageserver';
import { getExtension } from './utils/file-extension';
import { toDiagnostic } from './utils/diagnostic';
import { searchAndExtractHbs } from 'extract-tagged-template-literals';

import * as path from 'path';
import * as fs from 'fs';

import Server from './server';
import { Project } from './project-roots';

export interface TemplateLinterError {
  fatal?: boolean;
  moduleId: string;
  rule?: string;
  severity: number;
  message: string;
  line?: number;
  column?: number;
  source?: string;
}

const extensionsToLint: string[] = ['.hbs', '.js', '.ts'];

export default class TemplateLinter {

  private _linterCache = new Map<Project, any>();

  constructor(private server: Server) {}

  async lint(textDocument: TextDocument) {
    const ext = getExtension(textDocument);

    if (!extensionsToLint.includes(ext)) {
      return;
    }

    const config = this.getLinterConfig(textDocument.uri);

    if (!config) {
      return;
    }

    const TemplateLinter = await this.getLinter(textDocument.uri);

    let linter = null;
    try {
      linter = new TemplateLinter(config);
    } catch (e) {
      return;
    }

    const documentContent = textDocument.getText();
    const source = (ext === '.hbs') ? documentContent : searchAndExtractHbs(documentContent);

    const errors = linter.verify({
      source,
      moduleId: textDocument.uri
    });

    const diagnostics: Diagnostic[] = errors.map((error: TemplateLinterError) =>
      toDiagnostic(source, error)
    );

    this.server.connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
  }

  private getLinterConfig(uri: string): { configPath: string } | undefined {
    const project = this.server.projectRoots.projectForUri(uri);
    if (!project) {
      return;
    }

    const configPath = path.join(project.root, '.template-lintrc.js');
    if (!fs.existsSync(configPath)) {
      return;
    }

    return { configPath };
  }

  private async getLinter(uri: string) {
    const project = this.server.projectRoots.projectForUri(uri);
    if (!project) {
      return;
    }

    if (this._linterCache.has(project)) {
      return this._linterCache.get(project);
    }

    try {
      const nodePath = Files.resolveGlobalNodePath();
      if (!nodePath) {
        return;
      }
      const linterPath = await (Files.resolveModulePath(project.root, 'ember-template-lint', nodePath, () => {}) as Promise<any>);
      if (!linterPath) {
        return;
      }
      const linter = require(linterPath);
      this._linterCache.set(project, linter);
      return linter;
    } catch (error) {
      console.log('Module ember-template-lint not found.');
    }
  }
}
