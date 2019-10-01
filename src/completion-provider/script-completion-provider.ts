import {
  CompletionItem,
  TextDocumentPositionParams
} from 'vscode-languageserver';

import Server from '../server';
import ASTPath from '../glimmer-utils';
import { toPosition } from '../estree-utils';
import { filter } from 'fuzzaldrin';
import { parseScriptFile as parse } from 'ember-meta-explorer';
const { uniqBy } = require('lodash');
import { getExtension } from '../utils/file-extension';
import { log } from '../utils/logger';
import {
  isStoreModelLookup,
  isRouteLookup,
  isModelReference,
  isNamedServiceInjection,
  isTransformReference,
  isComputedPropertyArgument
} from '../utils/ast-helpers';
import {
  listRoutes,
  listModels,
  listServices,
  getProjectAddonsInfo,
  listTransforms
} from '../utils/layout-helpers';

import { ParseResult} from '@babel/core';

const EXTENSIONS = ['.js', '.ts'];

export default class ScriptCompletionProvider {
  constructor(private server: Server) {}
  provideCompletions(params: TextDocumentPositionParams): CompletionItem[] {
    log('provideCompletions');
    if (!EXTENSIONS.includes(getExtension(params.textDocument))) {
      return [];
    }
    const uri = params.textDocument.uri;
    const project = this.server.projectRoots.projectForUri(uri);
    if (!project) {
      return [];
    }
    const document = this.server.documents.get(uri);
    if (!document) {
      return [];
    }
    const { root } = project;
    const content = document.getText();

    let ast: ParseResult | null = null;
    try {
      ast = parse(content);
    } catch (e) {
      return [];
    }

    const focusPath = ASTPath.toPosition(ast, toPosition(params.position));

    if (!focusPath || !project || !document) {
      return [];
    }

    const completions: CompletionItem[] = [];
    let textPrefix = '';
    try {
      if (isStoreModelLookup(focusPath) || isModelReference(focusPath)) {
        textPrefix = focusPath.node.value;
        listModels(root).forEach(model => {
          completions.push(model);
        });
        getProjectAddonsInfo(root).filter((item: CompletionItem) => {
          if (item.detail === 'model') {
            completions.push(item);
          }
        });
      } else if (isRouteLookup(focusPath)) {
        textPrefix = focusPath.node.value;
        listRoutes(root).forEach(model => {
          completions.push(model);
        });
        getProjectAddonsInfo(root).filter((item: CompletionItem) => {
          if (item.detail === 'route') {
            completions.push(item);
          }
        });
      } else if (isNamedServiceInjection(focusPath)) {
        textPrefix = focusPath.node.value;
        listServices(root).forEach(model => {
          completions.push(model);
        });
        getProjectAddonsInfo(root).filter((item: CompletionItem) => {
          if (item.detail === 'service') {
            completions.push(item);
          }
        });
      } else if (isComputedPropertyArgument(focusPath)) {
        textPrefix = focusPath.node.value;
        if (!focusPath.parentPath || !focusPath.parentPath.parentPath) {
          return [];
        }
        const obj = focusPath.parentPath.parentPath.parent;
        (obj.properties || []).forEach((property: any) => {
          let name = null;
          if (property.key.type === 'StringLiteral') {
            name = property.key.value;
          } else if (property.key.type === 'Identifier') {
            name = property.key.name;
          }
          if (name !== null) {
            completions.push({
              kind: 10,
              label: name,
              detail: 'ObjectProperty'
            });
          }
        });
      } else if (isTransformReference(focusPath)) {
        textPrefix = focusPath.node.value;
        listTransforms(root).forEach((model: any) => {
          completions.push(model);
        });
        getProjectAddonsInfo(root).filter((item: CompletionItem) => {
          if (item.detail === 'transform') {
            completions.push(item);
          }
        });
      }
    } catch (e) {
      log('error', e);
    }

    return filter(uniqBy(completions, 'label'), textPrefix, {
      key: 'label',
      maxResults: 40
    });
  }
}
