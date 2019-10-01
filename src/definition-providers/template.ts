import { join } from 'path';
import * as fs from 'fs';

import {
  RequestHandler,
  TextDocumentPositionParams,
  Definition
} from 'vscode-languageserver';

import { isLinkToTarget } from './../utils/ast-helpers';
import { toPosition } from './../estree-utils';
import Server from './../server';
import ASTPath from './../glimmer-utils';
import {
  isTemplatePath,
  getComponentNameFromURI,
  getPodModulePrefix
} from './../utils/layout-helpers';

import {
  getAbstractHelpersParts,
  getAddonPathsForComponentTemplates,
  getPathsForComponentTemplates,
  getPathsForComponentScripts,
  pathsToLocationsWithPosition,
  pathsToLocations
} from './../utils/definition-helpers';

import { kebabCase } from 'lodash';
import { preprocess } from '@glimmer/syntax';
import { Project } from '../project-roots';

function normalizeAngleTagName(tagName: string) {
  return tagName
    .split('::')
    .map((item: string) => kebabCase(item))
    .join('/');
}

function looksLikeClassicComponentName(name: string) {
  return (
    name.length &&
    !name.includes('.') &&
    !name.includes(' ') &&
    name === name.toLowerCase()
  );
}

function extractValueForMaybeClassicComponentName(focusPath: ASTPath) {
  let value = '';
  const { node, parent } = focusPath;
  if (!parent) {
    return value;
  }

  if (node.type === 'StringLiteral' && parent.type === 'HashPair') {
    value = node.original;
  } else if (node.type === 'TextNode' && parent.type === 'AttrNode') {
    value = node.chars;
  }

  return value;
}

function maybeClassicComponentName(focusPath: ASTPath) {
  let value = extractValueForMaybeClassicComponentName(focusPath);
  return looksLikeClassicComponentName(value);
}

export function provideRouteDefinition(root: string, routeName: string) {
  const routeParts = routeName.split('.');
  const lastRoutePart = routeParts.pop();
  if (!lastRoutePart) {
    throw new Error(`Route name ${routeName} is ill-formed!`);
  }

  const routePaths = [
    join(root, 'app', 'routes', ...routeParts, lastRoutePart + '.js'),
    join(root, 'app', 'routes', ...routeParts, lastRoutePart + '.ts'),
    join(root, 'app', 'controllers', ...routeParts, lastRoutePart + '.js'),
    join(root, 'app', 'controllers', ...routeParts, lastRoutePart + '.ts'),
    join(root, 'app', 'templates', ...routeParts, lastRoutePart + '.hbs')
  ];

  const podPrefix = getPodModulePrefix(root);
  if (podPrefix) {
    for (const file in [
      'route.js',
      'route.ts',
      'controller.js',
      'controller.ts',
      'template.hbs'
    ]) {
      routePaths.push(
        join(root, 'app', podPrefix, ...routeParts, lastRoutePart, file)
      );
    }
  }

  return pathsToLocations(...routePaths);
}

function provideAngleBrackedComponentDefinition(
  root: string,
  focusPath: ASTPath
) {
  const maybeComponentName = normalizeAngleTagName(focusPath.node.tag);

  const appPaths = [
    ...getPathsForComponentScripts(root, maybeComponentName),
    ...getPathsForComponentTemplates(root, maybeComponentName)
  ].filter(fs.existsSync);

  const paths =
    appPaths.length > 0
      ? appPaths
      : getAddonPathsForComponentTemplates(root, maybeComponentName);

  return pathsToLocations(...paths.filter(isTemplatePath));
}

function provideBlockComponentDefinition(root: string, focusPath: ASTPath) {
  let maybeComponentName = focusPath.node.path.original;
  const appPaths = getPathsForComponentTemplates(
    root,
    maybeComponentName
  ).filter(fs.existsSync);

  const paths =
    appPaths.length > 0
      ? appPaths
      : getAddonPathsForComponentTemplates(root, maybeComponentName).filter(
          isTemplatePath
        );

  // getAddonPathsForComponentTemplates
  return pathsToLocationsWithPosition(paths, '{{yield');
}

function providePropertyDefinition(
  root: string,
  focusPath: ASTPath,
  uri: string
) {
  let maybeComponentName = getComponentNameFromURI(root, uri);
  if (!maybeComponentName) {
    return null;
  }

  const appPaths = getPathsForComponentScripts(root, maybeComponentName).filter(
    fs.existsSync
  );

  let paths =
    appPaths.length > 0
      ? appPaths
      : getAddonPathsForComponentTemplates(root, maybeComponentName).filter(
          name => !isTemplatePath(name)
        );

  const text = focusPath.node.original;
  return pathsToLocationsWithPosition(
    paths,
    text.replace('this.', '').split('.')[0]
  );
}

function provideComponentDefinition(root: string, maybeComponentName: string) {
  let helpers = getAbstractHelpersParts(root, 'app', maybeComponentName).map(
    pathParts => join(...pathParts.filter((part: any) => !!part))
  );

  let paths = [
    ...getPathsForComponentScripts(root, maybeComponentName),
    ...getPathsForComponentTemplates(root, maybeComponentName),
    ...helpers
  ].filter(fs.existsSync);

  if (!paths.length) {
    paths = getAddonPathsForComponentTemplates(root, maybeComponentName);
  }

  return pathsToLocations.apply(
    null,
    paths.length > 1 ? paths.filter(isTemplatePath) : paths
  );
}

function provideMustacheDefinition(root: string, focusPath: ASTPath) {
  const maybeComponentName =
    focusPath.node.type === 'ElementNode'
      ? normalizeAngleTagName(focusPath.node.tag)
      : focusPath.node.original;
  return provideComponentDefinition(root, maybeComponentName);
}

function provideHashPropertyUsage(root: string, focusPath: ASTPath) {
  let parentPath = focusPath.parentPath;
  if (parentPath && parentPath.parent && parentPath.parent.path) {
    const maybeComponentName = parentPath.parent.path.original;
    if (!maybeComponentName.includes('.') && maybeComponentName.includes('-')) {
      const appPaths = [
        ...getPathsForComponentScripts(root, maybeComponentName),
        ...getPathsForComponentTemplates(root, maybeComponentName)
      ].filter(fs.existsSync);

      const paths = (appPaths.length
        ? appPaths
        : getAddonPathsForComponentTemplates(root, maybeComponentName)
      ).filter(isTemplatePath);

      return pathsToLocationsWithPosition(paths, '@' + focusPath.node.key);
    }
  }
  return null;
}

function provideAngleBracketComponentAttributeUsage(
  root: string,
  focusPath: ASTPath
) {
  const maybeComponentName = normalizeAngleTagName(focusPath.parent.tag);

  const appPaths = [
    ...getPathsForComponentScripts(root, maybeComponentName),
    ...getPathsForComponentTemplates(root, maybeComponentName)
  ].filter(fs.existsSync);

  const paths = (appPaths.length
    ? appPaths
    : getAddonPathsForComponentTemplates(root, maybeComponentName)
  ).filter(isTemplatePath);

  return pathsToLocationsWithPosition(paths, focusPath.node.name);
}

function isLocalProperty(path: ASTPath) {
  return path.node.type === 'PathExpression' && !!path.node.this;
}

function isHashPairKey(path: ASTPath) {
  return path.node.type === 'HashPair';
}

function isAnglePropertyAttribute(path: ASTPath) {
  return path.node.type === 'AttrNode' && path.node.name.charAt(0) === '@';
}

function isActionName(path: ASTPath) {
  let node = path.node;
  if (!path.parent) {
    return false;
  }
  if (
    path.parent.type !== 'MustacheStatement' &&
    path.parent.type !== 'PathExpression' &&
    path.parent.type !== 'SubExpression' &&
    path.parent.type !== 'ElementModifierStatement'
  ) {
    return false;
  }

  if (
    !path.parent ||
    path.parent.path.original !== 'action' ||
    !path.parent.params[0] === node
  ) {
    return false;
  }

  if (node.type === 'StringLiteral') {
    return true;
  } else if (node.type === 'PathExpression' && node.this) {
    return true;
  }

  return false;
}

function isComponentWithBlock(path: ASTPath) {
  let node = path.node;
  return (
    node.type === 'BlockStatement' &&
    node.path.type === 'PathExpression' &&
    node.path.this === false &&
    node.path.original.includes('-') &&
    node.path.original.charAt(0) !== '-' &&
    !node.path.original.includes('.')
  );
}

function isAngleComponent(path: ASTPath) {
  return (
    path.node.type === 'ElementNode' &&
    path.node.tag.charAt(0) === path.node.tag.charAt(0).toUpperCase()
  );
}

function isComponentOrHelperName(path: ASTPath) {
  if (isAngleComponent(path)) {
    return true;
  }

  if (path.node.type === 'StringLiteral') {
    // if (node.original.includes('/')) {
    //   return true;
    // } else if (!node.original.includes('.') && node.original.includes('-')) {
    //   return true;
    // }
    if (
      path.parent &&
      path.parent.path.original === 'component' &&
      path.parent.params[0] === path.node
    ) {
      return true;
    }
  }

  if (path.node.type !== 'PathExpression') {
    return false;
  }

  let parent = path.parent;
  if (
    !parent ||
    parent.path !== path.node ||
    (parent.type !== 'MustacheStatement' &&
      parent.type !== 'BlockStatement' &&
      parent.type !== 'SubExpression')
  ) {
    return false;
  }

  return true;
}

export default class TemplateDefinitionProvider {
  private server: Server;

  constructor(server: Server) {
    this.server = server;
  }

  handle(
    params: TextDocumentPositionParams,
    project: Project
  ): Definition | null {
    let uri = params.textDocument.uri;
    const root = project.root;
    const document = this.server.documents.get(uri);
    if (!document) {
      return null;
    }

    let content = document.getText();
    let ast = preprocess(content);
    let focusPath = ASTPath.toPosition(ast, toPosition(params.position));

    if (!focusPath) {
      return null;
    }
    // <FooBar @some-component-name="my-component" /> || {{some-component some-name="my-component/name"}}
    if (maybeClassicComponentName(focusPath)) {
      return provideComponentDefinition(
        project.root,
        extractValueForMaybeClassicComponentName(focusPath)
      );
    } else if (isAngleComponent(focusPath)) {
      // <FooBar />
      return provideAngleBrackedComponentDefinition(root, focusPath);
      // {{#foo-bar}} {{/foo-bar}}
    } else if (isComponentWithBlock(focusPath)) {
      return provideBlockComponentDefinition(root, focusPath);

      // {{action "fooBar"}}, (action "fooBar"), (action this.fooBar), this.someProperty
    } else if (isActionName(focusPath) || isLocalProperty(focusPath)) {
      return providePropertyDefinition(root, focusPath, uri);

      // {{foo-bar}}
    } else if (isComponentOrHelperName(focusPath)) {
      return provideMustacheDefinition(root, focusPath);

      // <FooBar @somePropertyToFindUsage="" />
    } else if (isAnglePropertyAttribute(focusPath)) {
      return provideAngleBracketComponentAttributeUsage(root, focusPath);

      // {{hello propertyUsageToFind=someValue}}
    } else if (isHashPairKey(focusPath)) {
      return provideHashPropertyUsage(project.root, focusPath);
    } else if (isLinkToTarget(focusPath)) {
      return provideRouteDefinition(project.root, focusPath.node.original);
    }

    return null;
  }

  get handler(): RequestHandler<TextDocumentPositionParams, Definition, void> {
    return this.handle.bind(this);
  }
}
