import * as path from 'path';
import * as fs from 'fs';

import {
  RequestHandler,
  TextDocumentPositionParams,
  Definition
} from 'vscode-languageserver';

import { toPosition } from './../estree-utils';
import Server from './../server';
import ASTPath from './../glimmer-utils';

import {
  isTemplatePath,
  getComponentNameFromURI
} from './../utils/layout-helpers';

import {
  getAbstractHelpersParts,
  getAddonPathsForComponentTemplates,
  getPathsForComponentTemplates,
  getPathsForComponentScripts,
  pathsToLocationsWithPosition,
  pathsToLocations
} from './../utils/definition-helpers';

const { kebabCase } = require('lodash');
const memoize = require('memoizee');
const { preprocess } = require('@glimmer/syntax');

const mAddonPathsForComponentTemplates = memoize(
  getAddonPathsForComponentTemplates,
  { length: 2, maxAge: 600000 }
);

export default class TemplateDefinitionProvider {
  constructor(private server: Server) {}
  handle(params: TextDocumentPositionParams, project: any): Definition | null {
    let uri = params.textDocument.uri;
    const root = project.root;
    let content = this.server.documents.get(uri).getText();
    let ast = preprocess(content);
    let focusPath = ASTPath.toPosition(ast, toPosition(params.position));

    if (!focusPath) {
      return null;
    }

    // <FooBar />
    if (this.isAngleComponent(focusPath)) {
      return this.provideAngleBrackedComponentDefinition(root, focusPath);

      // {{#foo-bar}} {{/foo-bar}}
    } else if (this.isComponentWithBlock(focusPath)) {
      return this.provideBlockComponentDefinition(root, focusPath);

      // {{action "fooBar"}}, (action "fooBar"), (action this.fooBar), this.someProperty
    } else if (
      this.isActionName(focusPath) ||
      this.isLocalProperty(focusPath)
    ) {
      return this.providePropertyDefinition(root, focusPath, uri);

      // {{foo-bar}}
    } else if (this.isComponentOrHelperName(focusPath)) {
      return this.provideMustacheDefinition(root, focusPath);

      // <FooBar @somePropertyToFindUsage="" />
    } else if (this.isAnglePropertyAttribute(focusPath)) {
      return this.provideAngleBracketComponentAttributeUsage(root, focusPath);

      // {{hello propertyUsageToFind=someValue}}
    } else if (this.isHashPairKey(focusPath)) {
      return this.provideHashPropertyUsage(project.root, focusPath);
    }

    return null;
  }
  provideAngleBrackedComponentDefinition(root: string, focusPath: ASTPath) {
    const maybeComponentName = kebabCase(focusPath.node.tag);

    let paths = [
      ...getPathsForComponentScripts(root, maybeComponentName),
      ...getPathsForComponentTemplates(root, maybeComponentName)
    ].filter(fs.existsSync);

    if (!paths.length) {
      paths = mAddonPathsForComponentTemplates(root, maybeComponentName);
    }

    return pathsToLocations.apply(
      null,
      paths.length > 1
        ? paths.filter((postfix: string) => isTemplatePath(postfix))
        : paths
    );
  }
  provideBlockComponentDefinition(root: string, focusPath: ASTPath) {
    let maybeComponentName = focusPath.node.path.original;
    let paths: string[] = getPathsForComponentTemplates(
      root,
      maybeComponentName
    ).filter(fs.existsSync);
    if (!paths.length) {
      paths = mAddonPathsForComponentTemplates(root, maybeComponentName).filter(
        (name: string) => {
          return isTemplatePath(name);
        }
      );
    }
    // mAddonPathsForComponentTemplates
    return pathsToLocationsWithPosition(paths, '{{yield');
  }
  providePropertyDefinition(root: string, focusPath: ASTPath, uri: string) {
    let maybeComponentName = getComponentNameFromURI(root, uri);
    let paths: string[] = getPathsForComponentScripts(
      root,
      maybeComponentName
    ).filter(fs.existsSync);
    if (!paths.length) {
      paths = mAddonPathsForComponentTemplates(root, maybeComponentName).filter(
        (name: string) => {
          return !isTemplatePath(name);
        }
      );
    }
    const text = focusPath.node.original;
    return pathsToLocationsWithPosition(
      paths,
      text.replace('this.', '').split('.')[0]
    );
  }
  provideMustacheDefinition(root: string, focusPath: ASTPath) {
    const maybeComponentName =
      focusPath.node.type === 'ElementNode'
        ? kebabCase(focusPath.node.tag)
        : focusPath.node.original;

    let helpers = getAbstractHelpersParts(root, 'app', maybeComponentName).map(
      (pathParts: any) => {
        return path.join.apply(path, pathParts.filter((part: any) => !!part));
      }
    );

    let paths = [
      ...getPathsForComponentScripts(root, maybeComponentName),
      ...getPathsForComponentTemplates(root, maybeComponentName),
      ...helpers
    ].filter(fs.existsSync);

    if (!paths.length) {
      paths = mAddonPathsForComponentTemplates(root, maybeComponentName);
    }

    return pathsToLocations.apply(
      null,
      paths.length > 1 ? paths.filter(isTemplatePath) : paths
    );
  }
  provideHashPropertyUsage(root: string, focusPath: ASTPath) {
    let parentPath = focusPath.parentPath;
    if (parentPath && parentPath.parent && parentPath.parent.path) {
      const maybeComponentName = parentPath.parent.path.original;
      if (
        !maybeComponentName.includes('.') &&
        maybeComponentName.includes('-')
      ) {
        let paths = [
          ...getPathsForComponentScripts(root, maybeComponentName),
          ...getPathsForComponentTemplates(root, maybeComponentName)
        ].filter(fs.existsSync);

        if (!paths.length) {
          paths = mAddonPathsForComponentTemplates(root, maybeComponentName);
        }

        const finalPaths =
          paths.length > 1
            ? paths.filter((postfix: string) => isTemplatePath(postfix))
            : paths;
        return pathsToLocationsWithPosition(
          finalPaths,
          '@' + focusPath.node.key
        );
      }
    }
    return null;
  }
  provideAngleBracketComponentAttributeUsage(root: string, focusPath: ASTPath) {
    const maybeComponentName = kebabCase(focusPath.parent.tag);

    let paths = [
      ...getPathsForComponentScripts(root, maybeComponentName),
      ...getPathsForComponentTemplates(root, maybeComponentName)
    ].filter(fs.existsSync);

    if (!paths.length) {
      paths = mAddonPathsForComponentTemplates(root, maybeComponentName);
    }

    const finalPaths =
      paths.length > 1
        ? paths.filter((postfix: string) => isTemplatePath(postfix))
        : paths;
    return pathsToLocationsWithPosition(finalPaths, focusPath.node.name);
  }

  get handler(): RequestHandler<TextDocumentPositionParams, Definition, void> {
    return this.handle.bind(this);
  }

  isLocalProperty(path: ASTPath) {
    let node = path.node;
    if (node.type === 'PathExpression') {
      return node.this;
    }
    return false;
  }

  isHashPairKey(path: ASTPath) {
    let node = path.node;
    return node.type === 'HashPair';
  }

  isAnglePropertyAttribute(path: ASTPath) {
    let node = path.node;
    if (node.type === 'AttrNode') {
      if (node.name.charAt(0) === '@') {
        return true;
      }
    }
  }

  isActionName(path: ASTPath) {
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

  isComponentWithBlock(path: ASTPath) {
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

  isAngleComponent(path: ASTPath) {
    let node = path.node;

    if (node.type === 'ElementNode') {
      if (node.tag.charAt(0) === node.tag.charAt(0).toUpperCase()) {
        return true;
      }
    }
  }

  isComponentOrHelperName(path: ASTPath) {
    let node = path.node;

    if (this.isAngleComponent(path)) {
      return true;
    }

    if (node.type === 'StringLiteral') {
      // if (node.original.includes('/')) {
      //   return true;
      // } else if (!node.original.includes('.') && node.original.includes('-')) {
      //   return true;
      // }
      if (
        path.parent &&
        path.parent.path.original === 'component' &&
        path.parent.params[0] === node
      ) {
        return true;
      }
    }

    if (node.type !== 'PathExpression') {
      return false;
    }

    let parent = path.parent;
    if (
      !parent ||
      parent.path !== node ||
      (parent.type !== 'MustacheStatement' &&
        parent.type !== 'BlockStatement' &&
        parent.type !== 'SubExpression')
    ) {
      return false;
    }

    return true;
  }
}