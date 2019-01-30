import { extname, join } from 'path';
import { existsSync } from 'fs';

import {
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams
} from 'vscode-languageserver';

import Server from '../server';
import ASTPath from '../glimmer-utils';
import { toPosition } from '../estree-utils';
import { filter } from 'fuzzaldrin';

const { preprocess } = require('@glimmer/syntax');

import {
  emberBlockItems,
  emberMustacheItems,
  emberSubExpressionItems
} from './ember-helpers';
import uniqueBy from '../utils/unique-by';
import { getExtension } from '../utils/file-extension';

import walkSync = require('walk-sync');

const safeWalkSync = (path: string, options?: walkSync.WalkSyncOptions | undefined) => {
  if (existsSync(path)) {
    return walkSync(path, options);
  }
  return [];
};

export default class TemplateCompletionProvider {
  constructor(private server: Server) {}

  provideCompletions(params: TextDocumentPositionParams): CompletionItem[] {
    const uri = params.textDocument.uri;

    if (getExtension(params.textDocument) !== '.hbs') {
      return [];
    }

    const project = this.server.projectRoots.projectForUri(uri);
    if (!project) {
      return [];
    }

    let document = this.server.documents.get(uri);
    let offset = document.offsetAt(params.position);
    let originalText = document.getText();
    let text = originalText.slice(0, offset) + 'ELSCompletionDummy' + originalText.slice(offset);
    let ast = preprocess(text);
    let focusPath = ASTPath.toPosition(ast, toPosition(params.position));
    if (!focusPath) {
      return [];
    }

    const { root, podRoot } = project;
    let completions: CompletionItem[] = [];

    if (isMustachePath(focusPath)) {
      completions.push(...listComponents(root, podRoot));
      completions.push(...listHelpers(root));
      completions.push(...emberMustacheItems);
    } else if (isBlockPath(focusPath)) {
      completions.push(...listComponents(root, podRoot));
      completions.push(...emberBlockItems);
    } else if (isSubExpressionPath(focusPath)) {
      completions.push(...listHelpers(root));
      completions.push(...emberSubExpressionItems);
    } else if (isLinkToTarget(focusPath)) {
      completions.push(...listRoutes(root, podRoot));
    }

    return filter(completions, getTextPrefix(focusPath), { key: 'label' });
  }
}

function listComponents(root: string, podRoot: string): CompletionItem[] {

  const jsPaths = safeWalkSync(join(root, 'app', 'components'), {
    directories: false,
    globs: ['**/*.js']
  });
  const hbsPaths = safeWalkSync(join(root, 'app', 'templates', 'components'), {
    directories: false,
    globs: ['**/*.hbs']
  });

  const podComponentsDirectory = join(root, 'app', podRoot, 'components');

  const podsHbsPaths = safeWalkSync(podComponentsDirectory, {
    directories: false,
    globs: ['**/template.hbs']
  }).map(path => path.replace('/template.hbs', ''));

  const podsJsPaths = safeWalkSync(podComponentsDirectory, {
    directories: false,
    globs: ['**/component.js']
  }).map(path => path.replace('/component.js', ''));

  const paths = [...jsPaths, ...hbsPaths, ...podsHbsPaths, ...podsJsPaths];

  const items = paths
    .map((filePath: string) => {
      return {
        kind: CompletionItemKind.Class,
        label: filePath.replace(extname(filePath), ''),
        detail: 'component',
      };
    });

  return uniqueBy(items, 'label');
}

function listHelpers(root: string): CompletionItem[] {
  const paths = safeWalkSync(join(root, 'app', 'helpers'), {
    directories: false,
    globs: ['**/*.js']
  });

  const items = paths
    .map((filePath: string) => {
      return {
        kind: CompletionItemKind.Function,
        label: filePath.replace(extname(filePath), ''),
        detail: 'helper',
      };
    });

  return uniqueBy(items, 'label');
}

function listRoutes(root: string, podRoot: string): CompletionItem[] {
  const paths = safeWalkSync(join(root, 'app', 'routes'), {
    directories: false,
    globs: ['**/*.js']
  });

  const podPaths = safeWalkSync(join(root, 'app', podRoot), {
    directories: false,
    globs: ['**/route.js']
  }).map((path: string) => path.replace('/route.js', ''));

  const items = [...paths, ...podPaths]
    .map((filePath: string) => {
      const label = filePath
        .replace(extname(filePath), '')
        .replace(/\//g, '.');
      return {
        kind: CompletionItemKind.File,
        label,
        detail: 'route',
      };
    });

  return uniqueBy(items, 'label');
}

function isMustachePath(path: ASTPath): boolean {
  let node = path.node;
  if (node.type !== 'PathExpression') { return false; }
  let parent = path.parent;
  if (!parent || parent.type !== 'MustacheStatement') { return false; }
  return parent.path === node;
}

function isBlockPath(path: ASTPath): boolean {
  let node = path.node;
  if (node.type !== 'PathExpression') { return false; }
  let parent = path.parent;
  if (!parent || parent.type !== 'BlockStatement') { return false; }
  return parent.path === node;
}

function isSubExpressionPath(path: ASTPath): boolean {
  let node = path.node;
  if (node.type !== 'PathExpression') { return false; }
  let parent = path.parent;
  if (!parent || parent.type !== 'SubExpression') { return false; }
  return parent.path === node;
}

function isLinkToTarget(path: ASTPath): boolean {
  return isInlineLinkToTarget(path) || isBlockLinkToTarget(path);
}

function isInlineLinkToTarget(path: ASTPath): boolean {
  let node = path.node;
  if (node.type !== 'StringLiteral') { return false; }
  let parent = path.parent;
  if (!parent || parent.type !== 'MustacheStatement') { return false; }
  return parent.params[1] === node && parent.path.original === 'link-to';
}

function isBlockLinkToTarget(path: ASTPath): boolean {
  let node = path.node;
  if (node.type !== 'StringLiteral') { return false; }
  let parent = path.parent;
  if (!parent || parent.type !== 'BlockStatement') { return false; }
  return parent.params[0] === node && parent.path.original === 'link-to';
}

function getTextPrefix({ node: { original = '' } }: ASTPath): string {
  return original.replace('ELSCompletionDummy', '');
}
