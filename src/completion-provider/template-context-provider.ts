import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';

import {
  getPodModulePrefix,
  pureComponentName
} from '../utils/layout-helpers';

import { log } from '../utils/logger';

import {
  extractComponentInformationFromMeta,
  processJSFile,
  processTemplate
} from 'ember-meta-explorer';

import { uniqBy } from 'lodash';

function localizeName(name: string) {
  if (name.startsWith('this.')) {
    return name;
  } else if (name.startsWith('@')) {
    return name;
  } else {
    return 'this.' + name;
  }
}

export function templateContextLookup(
  root: string,
  currentFilePath: string,
  templateContent: string
) {
  log('templateContextLookup', root, currentFilePath, templateContent);
  const nameParts = currentFilePath.split('/components/');
  if (nameParts.length !== 2) {
    return [];
  }
  let componentName = pureComponentName(nameParts[1].split('.')[0]);
  return componentsContextData(root, componentName, templateContent);
}

function findComponentScripts(root: string, componentName: string) {
  const possibleLocations = [];
  possibleLocations.push([root, 'app', 'components', componentName, 'component.js']);
  possibleLocations.push([root, 'app', 'components', componentName, 'component.ts']);
  possibleLocations.push([root, 'app', 'components', componentName + '.js']);
  possibleLocations.push([root, 'app', 'components', componentName + '.ts']);
  const prefix = getPodModulePrefix(root);
  if (prefix) {
    possibleLocations.push([root, 'app', prefix, 'components', componentName, 'component.js']);
    possibleLocations.push([root, 'app', prefix, 'components', componentName, 'component.ts']);
  }
  return possibleLocations.map((locArr: string[]) => join.apply(null, locArr));
}

function componentsContextData(
  root: string,
  componentName: string,
  templateContent: string
): CompletionItem[] {
  const maybeScripts = findComponentScripts(root, componentName);
  const existingScripts = maybeScripts.filter(existsSync);
  if (!existingScripts.length) {
    return [];
  }
  const filePath = existingScripts.pop();
  const fileContent = readFileSync(filePath, { encoding: 'utf8' });
  const infoItems: any[] = [];

  try {
    const jsMeta = processJSFile(fileContent, filePath);
    log('jsMeta', jsMeta);
    infoItems.push(jsMeta);
  } catch (e) {
    log('template-context-lookup-error', e.toString());
  }

  try {
    let templateInfo: any = null;
    templateInfo = processTemplate(templateContent);
    infoItems.push(templateInfo);
  } catch (e) {
    log('templateError', e);
  }

  log('infoItems', infoItems);

  const meta: any = infoItems
    .filter((item: any) => item !== null)
    .reduce((result: any, it: any) => {
      log('it', it);
      Object.keys(it).forEach(name => {
        if (name in result) {
          result[name] = result[name].concat(it[name]);
        } else {
          result[name] = it[name].slice(0);
        }
      });
      return result;
    }, {});
  const items: CompletionItem[] = [];
  log('meta', meta);
  let contextInfo: any = {};
  try {
    contextInfo = extractComponentInformationFromMeta(meta);
  } catch (e) {
    log('contextInforError', e);
  }
  log('contextInfo', contextInfo);

  contextInfo.jsProps.forEach((propName: string) => {
    const [name]: any = propName.split(' ');
    items.push({
      kind: CompletionItemKind.Property,
      label: localizeName(name),
      detail: propName
    });
  });
  contextInfo.jsComputeds.forEach((propName: string) => {
    const [name]: any = propName.split(' ');
    items.push({
      kind: CompletionItemKind.Property,
      label: localizeName(name),
      detail: 'ComputedProperty: ' + propName
    });
  });
  contextInfo.jsFunc.forEach((propName: string) => {
    const [name]: any = propName.split(' ');
    items.push({
      kind: CompletionItemKind.Function,
      label: localizeName(name),
      detail: 'Function: ' + propName
    });
  });
  contextInfo.hbsProps.forEach((propName: string) => {
    const [name]: any = propName.split(' ');
    items.push({
      kind: CompletionItemKind.Function,
      label: name,
      detail: 'Template Property: ' + propName
    });
  });
  // contextInfo.api.actions.forEach((propName: string) => {
  //   const [name]: any = propName.split(' ');
  //   items.push({
  //     kind: CompletionItemKind.Event,
  //     label: name,
  //     detail: 'Component Action: ' + propName,
  //   });
  // });
  // @todo actions
  return uniqBy(items, 'label');
}
