import {
  CompletionItem,
  TextDocumentPositionParams
} from 'vscode-languageserver';

import Server from '../server';
import ASTPath from '../glimmer-utils';
import { toPosition } from '../estree-utils';
import { filter } from 'fuzzaldrin';

const { preprocess } = require('@glimmer/syntax');
const { uniqBy, startCase, camelCase } = require('lodash');
import {
  emberBlockItems,
  emberMustacheItems,
  emberSubExpressionItems
} from './ember-helpers';
import { templateContextLookup } from './template-context-provider';
import { getExtension } from '../utils/file-extension';
import { log } from '../utils/logger';
import {
  isLinkToTarget,
  isMustachePath,
  isBlockPath,
  isSubExpressionPath,
  isAngleComponentPath,
  isModifierPath
} from '../utils/ast-helpers';
import {
  listComponents,
  listPodsComponents,
  listHelpers,
  listRoutes,
  listModifiers,
  builtinModifiers,
  getProjectAddonsInfo
} from '../utils/layout-helpers';
import { searchAndExtractHbs } from 'extract-tagged-template-literals';

function toAngleBrackedName(name: string) {
  return name.split('/').map((part: string) => {
    return startCase(camelCase(part)).split(' ').join('');
  }).join('::');
}

const extensionsToProvideTemplateCompletions = ['.hbs', '.js', '.ts'];

type ComponentLabels = Array<{ label: string }>;

const PLACEHOLDER = 'ELSCompletionDummy';
export default class TemplateCompletionProvider {
  constructor(private server: Server) {}
  getAllAngleBracketComponents(root: string, uri: string): ComponentLabels {
    log(uri);
    return uniqBy(
      ([] as CompletionItem[])
        .concat(
          listComponents(root),
          listPodsComponents(root),
          getProjectAddonsInfo(root).filter(({detail}) => detail === 'component')
        )
        .map(item => {
          return Object.assign({}, item, {
            label: toAngleBrackedName(item.label)
          });
        }),
      'label'
    );
  }
  getMustachePathCandidates(root: string, uri: string, originalText: string) {
    let candidates: any = [
      ...templateContextLookup(root, uri, originalText),
      ...listComponents(root),
      ...listPodsComponents(root),
      ...listHelpers(root),
      ...getProjectAddonsInfo(root).filter(
        ({detail}) => detail === 'component' || detail === 'helper'
      )
    ];
    return candidates;
  }
  getBlockPathCandidates(root: string, uri: string, originalText: string) {
    let candidates = [
      ...templateContextLookup(root, uri, originalText),
      ...listComponents(root),
      ...listPodsComponents(root),
      ...getProjectAddonsInfo(root).filter(({detail}) => detail === 'component')
    ];
    return candidates;
  }
  getSubExpressionPathCandidates(root: string, uri: string, originalText: string) {
    let candidates = [
      ...templateContextLookup(root, uri, originalText),
      ...listHelpers(root),
      ...getProjectAddonsInfo(root).filter(({detail}) => detail === 'helper')
    ];
    return candidates;
  }
  getTextForGuessing(originalText: string, offset: number, PLACEHOLDER: string) {
    return originalText.slice(0, offset) +
    PLACEHOLDER +
    originalText.slice(offset);
  }
  provideCompletions(params: TextDocumentPositionParams): CompletionItem[] {
    log('provideCompletions');
    const ext = getExtension(params.textDocument);

    if (!extensionsToProvideTemplateCompletions.includes(ext)) {
      return [];
    }

    const uri = params.textDocument.uri;
    const project = this.server.projectRoots.projectForUri(uri);
    const document = this.server.documents.get(uri);
    if (!project || !document) {
      return [];
    }
    const { root } = project;
    const offset = document.offsetAt(params.position);
    const documentContent = document.getText();
    const originalText = (ext === '.hbs') ? documentContent : searchAndExtractHbs(documentContent);
    log('originalText', originalText);
    const completions: CompletionItem[] = [];
    let normalPlaceholder: any = PLACEHOLDER;
    let ast: any = {};

    const cases = [
      PLACEHOLDER + ' />',
      PLACEHOLDER,
      PLACEHOLDER + '"',
      PLACEHOLDER + '}}',
      PLACEHOLDER + '\''
    ];

    while (cases.length) {
      normalPlaceholder = cases.shift();
      try {
        let validText = this.getTextForGuessing(originalText, offset, normalPlaceholder);
        ast = preprocess(validText);
        log('validText', validText);
        break;
      } catch (e) {
        log('parsing-error', this.getTextForGuessing(originalText, offset, normalPlaceholder));
        ast = null;
      }
    }
    log('ast must exists');
    if (ast === null) {
      return [];
    }

    const focusPath = ASTPath.toPosition(ast, toPosition(params.position));

    if (!focusPath) {
      log('focus path does not exists');
      return [];
    }
    log(focusPath.node);
    try {
      if (isAngleComponentPath(focusPath)) {
        log('isAngleComponentPath');
        // <Foo>
        const candidates = this.getAllAngleBracketComponents(root, uri);
        log(candidates);
        completions.push(...uniqBy(candidates, 'label'));
      } else if (isMustachePath(focusPath)) {
        // {{foo-bar?}}
        const candidates = this.getMustachePathCandidates(root, uri, originalText);
        completions.push(...uniqBy(candidates, 'label'));
        completions.push(...emberMustacheItems);
      } else if (isBlockPath(focusPath)) {
        // {{#foo-bar?}} {{/foo-bar}}
        const candidates = this.getBlockPathCandidates(root, uri, originalText);
        completions.push(...uniqBy(candidates, 'label'));
        completions.push(...emberBlockItems);
      } else if (isSubExpressionPath(focusPath)) {
        // {{foo-bar name=(subexpr? )}}
        const candidates = this.getSubExpressionPathCandidates(root, uri, originalText);
        completions.push(...uniqBy(candidates, 'label'));
        completions.push(...emberSubExpressionItems);
      } else if (isLinkToTarget(focusPath)) {
        // {{link-to "name" "target?"}}, {{#link-to "target?"}} {{/link-to}}
        completions.push(...uniqBy(listRoutes(root), 'label'));
      } else if (isModifierPath(focusPath)) {
        const addonModifiers = getProjectAddonsInfo(root).filter(
          ({detail}) => detail === 'modifier'
        );
        completions.push(...uniqBy([...listModifiers(root), ...addonModifiers, ...builtinModifiers()], 'label'));
      }
    } catch (e) {
      log('error', e);
    }

    log('prefix', getTextPrefix(focusPath, normalPlaceholder));
    return filter(completions, getTextPrefix(focusPath, normalPlaceholder), {
      key: 'label',
      maxResults: 40
    });
  }
}

function getTextPrefix({ node }: ASTPath, normalPlaceholder: string): string {
  let target = node.original || node.tag || '';
  return target.replace(normalPlaceholder, '').replace(PLACEHOLDER, '');
}
