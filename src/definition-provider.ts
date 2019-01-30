import * as path from 'path';
import * as fs from 'fs';

import { RequestHandler, TextDocumentPositionParams, Definition, Location, Range } from 'vscode-languageserver';

import { parse } from 'babylon';

import { toPosition } from './estree-utils';
import Server from './server';
import ASTPath from './glimmer-utils';
import { getExtension } from './utils/file-extension';
import URI from 'vscode-uri';

const { preprocess } = require('@glimmer/syntax');

export default class DefinitionProvider {
  constructor(private server: Server) {}

  handle(params: TextDocumentPositionParams): Definition | null {
    let uri = params.textDocument.uri;

    const project = this.server.projectRoots.projectForUri(uri);
    if (!project) {
      return null;
    }

    let extension = getExtension(params.textDocument);

    if (extension === '.hbs') {
      let content = this.server.documents.get(uri).getText();
      let ast = preprocess(content);
      let focusPath = ASTPath.toPosition(ast, toPosition(params.position));
      if (!focusPath) {
        return null;
      }

      if (this.isComponentOrHelperName(focusPath)) {
        const componentOrHelperName = focusPath.node.original;

        const podComponentPath   = path.join(project.root, 'app', project.podRoot, 'components', componentOrHelperName, 'component.js');
        const podTemplatePath    = path.join(project.root, 'app', project.podRoot, 'components', componentOrHelperName, 'template.hbs');

        const componentPath   = path.join(project.root, 'app', 'components', `${componentOrHelperName}.js`);
        const templatePath    = path.join(project.root, 'app', 'templates', 'components', `${componentOrHelperName}.hbs`);
        const helperPath      = path.join(project.root, 'app', 'helpers', `${componentOrHelperName}.js`);

        return pathsToLocations(componentPath, templatePath, helperPath, podComponentPath, podTemplatePath);
      }
    } else if (extension === '.js') {
      let content = this.server.documents.get(uri).getText();
      let ast = parse(content, {
        sourceType: 'module'
      });
      let astPath = ASTPath.toPosition(ast, toPosition(params.position));
      if (!astPath) {
        return null;
      }

      if (isModelReference(astPath)) {
        let modelName = astPath.node.value;

        const modelPath = path.join(project.root, 'app', 'models', `${modelName}.js`);
        const podModelPath = path.join(project.root, 'app', project.podRoot, modelName, 'model.js');

        return pathsToLocations(modelPath, podModelPath);
      } else if (isTransformReference(astPath)) {
        let transformName = astPath.node.value;

        const transformPath = path.join(project.root, 'app', 'transforms', `${transformName}.js`);

        return pathsToLocations(transformPath);
      }
    }

    return null;
  }

  get handler(): RequestHandler<TextDocumentPositionParams, Definition, void> {
    return this.handle.bind(this);
  }

  isComponentOrHelperName(path: ASTPath) {
    let node = path.node;
    if (node.type !== 'PathExpression') {
      return false;
    }

    let parent = path.parent;
    if (!parent || parent.path !== node || (parent.type !== 'MustacheStatement' && parent.type !== 'BlockStatement')) {
      return false;
    }

    return true;
  }
}

function isModelReference(astPath: ASTPath): boolean {
  let node = astPath.node;
  if (node.type !== 'StringLiteral') { return false; }
  let parent = astPath.parent;
  if (!parent || parent.type !== 'CallExpression' || parent.arguments[0] !== node) { return false; }
  let identifier = (parent.callee.type === 'Identifier') ? parent.callee : parent.callee.property;
  return identifier.name === 'belongsTo' || identifier.name === 'hasMany';
}

function isTransformReference(astPath: ASTPath): boolean {
  let node = astPath.node;
  if (node.type !== 'StringLiteral') { return false; }
  let parent = astPath.parent;
  if (!parent || parent.type !== 'CallExpression' || parent.arguments[0] !== node) { return false; }
  let identifier = (parent.callee.type === 'Identifier') ? parent.callee : parent.callee.property;
  return identifier.name === 'attr';
}

function pathsToLocations(...paths: string[]): Location[] {
  return paths
    .filter(fs.existsSync)
    .map(modulePath => {
      return Location.create(URI.file(modulePath).toString(), Range.create(0, 0, 0, 0));
    });
}
