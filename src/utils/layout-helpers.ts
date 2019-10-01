import * as walkSync from 'walk-sync';
import { join, sep, extname, dirname } from 'path';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';

import { readFileSync, existsSync } from 'fs';

export function safeWalkSync(filePath: string | false, opts: walkSync.Options) {
  if (!filePath) {
    return [];
  }
  if (!existsSync(filePath)) {
    return [];
  }
  return walkSync(filePath, opts);
}

export function getPodModulePrefix(root: string): string | null {
  // log('listPodsComponents');
  let appConfig: (mode: string) => { podModulePrefix?: string };
  try {
    appConfig = require(join(root, 'config', 'environment.js'));
    // log('appConfig', appConfig);
  } catch (e) {
    // log('catch', e);
    return null;
  }

  const prefixFromConfig = appConfig('development').podModulePrefix || '';
  const podModulePrefix = prefixFromConfig.includes('/')
    ? prefixFromConfig.split('/').pop()
    : prefixFromConfig;

  if (!podModulePrefix) {
    return null;
  }

  return podModulePrefix.trim().length > 0 ? podModulePrefix : null;
}

export function resolvePackageRoot(root: string, addonName: string, packagesFolder = 'node_modules') {
  const roots = root.split(sep);
  while (roots.length) {
    const maybePath = join(roots.join(sep), packagesFolder, addonName);
    const linkedPath = join(roots.join(sep), addonName);
    if (existsSync(join(maybePath, 'package.json'))) {
      return maybePath;
    } else if (existsSync(join(linkedPath, 'package.json'))) {
      return linkedPath;
    }
    roots.pop();
  }
  return false;
}

export function isProjectAddonRoot(root: string) {
  const pack = getPackageJSON(root);
  const hasIndexJs = existsSync(join(root, 'index.js'));
  return isEmberAddon(pack) && hasIndexJs;
}

export function getProjectInRepoAddonsRoots(root: string) {
  const prefix = 'lib';
  const addons = safeWalkSync(join(root, prefix), {
    directories: true,
    globs: ['**/package.json']
  });

  const roots: string[] = [];
  const validRoots = addons
    .map(relativePath => dirname(join(root, prefix, relativePath)))
    .filter(isProjectAddonRoot);

  for (const validRoot in validRoots) {
    roots.push(validRoot);
    for (const relatedRoot in getProjectAddonsRoots(validRoot, roots)) {
      if (!roots.includes(relatedRoot)) {
        roots.push(relatedRoot);
      }
    }
  }

  return roots;
}

export function getProjectAddonsRoots(root: string, resolvedItems: string[] = [], packageFolderName = 'node_modules') {
  // log('getProjectAddonsInfo', root);
  const pack = getPackageJSON(root);
  if (resolvedItems.length) {
    if (!isEmberAddon(pack)) {
      return [];
    }
  }
  // log('getPackageJSON', pack);
  const items = resolvedItems.length ?
    [
      ...Object.keys(pack.dependencies || {}),
      ...Object.keys(pack.peerDependencies || {})
    ] : [
    ...Object.keys(pack.dependencies || {}),
    ...Object.keys(pack.peerDependencies || {}),
    ...Object.keys(pack.devDependencies || {})
  ];
  // log('items', items);

  const roots = items
    .map((item: string) => {
      return resolvePackageRoot(root, item, packageFolderName);
    })
    .filter((p: string | boolean) => {
      return p !== false;
    });
  const recursiveRoots: string[] = resolvedItems.slice(0);
  roots.forEach((rootItem: string) => {
    if (!recursiveRoots.includes(rootItem)) {
      recursiveRoots.push(rootItem);
      getProjectAddonsRoots(rootItem, recursiveRoots, packageFolderName).forEach((item: string) => {
        if (!recursiveRoots.includes(item)) {
          recursiveRoots.push(item);
        }
      });
    }
  });
  return recursiveRoots;
}

export function getPackageJSON(file: string) {
  try {
    const result = JSON.parse(readFileSync(join(file, 'package.json'), 'utf8'));
    return result;
  } catch (e) {
    return {};
  }
}

interface PackageInfo {
  keywords?: string[];
  'ember-addon'?: {
    version?: number
  };
}

export function isEmberAddon(info: PackageInfo) {
  return info.keywords && info.keywords.includes('ember-addon');
}

function addonVersion(info: PackageInfo) {
  if (!isEmberAddon(info)) {
    return null;
  }
  return isEmberAddonV2(info) ? 2 : 1;
}

function isEmberAddonV2(info: PackageInfo) {
  return info['ember-addon'] && info['ember-addon'].version === 2;
}

export function isTemplatePath(filePath: string) {
  return filePath.endsWith('.hbs');
}

export function hasAddonFolderInPath(name: string) {
  return name.includes(sep + 'addon' + sep);
}

/**
  Push the items in `newContents` into `target` if `newContents` is not empty.

  Useful for cases where performance of reallocating arrays is a concern.

  @warn **NOTE:** this mutates `target`. It returns `target` for convenience.
 */
function pushIfNotEmpty<T>(target: T[]): (newContents: T[]) => void {
  return newContents => {
    if (newContents.length) {
      target.push(...newContents);
    }
  };
}

export function getProjectAddonsInfo(root: string) {
  const roots = ([] as string[]).concat(
    getProjectAddonsRoots(root),
    getProjectInRepoAddonsRoots(root)
  );

  return roots.reduce(
    (completionItems, root) => {
      const info = getPackageJSON(root);
      const version = addonVersion(info);
      if (version === 1) {
        let completionItemLists = [
          listComponents(root),
          listRoutes(root),
          listHelpers(root),
          listModels(root),
          listTransforms(root),
          listServices(root),
          listModifiers(root)
        ];

        completionItemLists.forEach(pushIfNotEmpty(completionItems));
      }

      return completionItems;
    },
    [] as CompletionItem[]
  );
}

export function pureComponentName(relativePath: string) {
  const ext = extname(relativePath); // .hbs
  if (relativePath.startsWith('/')) {
    relativePath = relativePath.slice(1);
  }
  if (relativePath.endsWith(`/template${ext}`)) {
    return relativePath.replace(`/template${ext}`, '');
  } else if (relativePath.endsWith(`/component${ext}`)) {
    return relativePath.replace(`/component${ext}`, '');
  } else if (relativePath.endsWith(`/helper${ext}`)) {
    return relativePath.replace(`/helper${ext}`, '');
  } else {
    return relativePath.replace(ext, '');
  }
}

export function listPodsComponents(root: string): CompletionItem[] {
  let podModulePrefix = getPodModulePrefix(root);
  if (podModulePrefix === null) {
    return [];
  }
  // log('listComponents');
  const jsPaths = safeWalkSync(
    join(root, 'app', podModulePrefix, 'components'),
    {
      directories: false,
      globs: ['**/*.{js,ts,hbs}']
    }
  );

  const items = jsPaths.map((filePath: string) => {
    return {
      kind: CompletionItemKind.Class,
      label: pureComponentName(filePath),
      detail: 'component'
    };
  });

  // log('pods-items', items);
  return items;
}

export function builtinModifiers(): CompletionItem[] {
  return [
    {
      kind: CompletionItemKind.Method,
      label: 'action',
      detail: 'modifier'
    }
  ];
}

export function listComponents(root: string): CompletionItem[] {
  // log('listComponents');
  const jsPaths = safeWalkSync(join(root, 'app', 'components'), {
    directories: false,
    globs: ['**/*.{js,ts,hbs}']
  });

  const hbsPaths = safeWalkSync(join(root, 'app', 'templates', 'components'), {
    directories: false,
    globs: ['**/*.hbs']
  });

  const paths = [...jsPaths, ...hbsPaths];

  const items = paths.map((filePath: string) => {
    return {
      kind: CompletionItemKind.Class,
      label: pureComponentName(filePath),
      detail: 'component'
    };
  });

  return items;
}

function listCollection(root: string, prefix: 'app' | 'addon', collectionName: 'transforms' | 'modifiers' | 'services' | 'models' | 'helpers', kindType: CompletionItemKind, detail: 'transform' | 'service' | 'model' | 'helper' | 'modifier') {
  const paths = safeWalkSync(join(root, prefix, collectionName), {
    directories: false,
    globs: ['**/*.{js,ts}']
  });

  const items = paths.map((filePath: string) => {
    return {
      kind: kindType,
      label: pureComponentName(filePath),
      detail
    };
  });

  return items;
}

export function listModifiers(root: string): CompletionItem[] {
  return listCollection(root, 'app', 'modifiers', CompletionItemKind.Function, 'modifier');
}

export function listModels(root: string): CompletionItem[] {
  return listCollection(root, 'app', 'models', CompletionItemKind.Class, 'model');
}

export function listServices(root: string): CompletionItem[] {
  return listCollection(root, 'app', 'services', CompletionItemKind.Class, 'service');
}

export function listHelpers(root: string): CompletionItem[] {
  return listCollection(root, 'app', 'helpers', CompletionItemKind.Function, 'helper');
}

export function listTransforms(root: string): CompletionItem[] {
  return listCollection(root, 'app', 'transforms', CompletionItemKind.Function, 'transform');
}

export function listRoutes(root: string): CompletionItem[] {
  // log('listRoutes');
  const paths = safeWalkSync(join(root, 'app', 'routes'), {
    directories: false,
    globs: ['**/*.{js,ts}']
  });

  const templatePaths = safeWalkSync(join(root, 'app', 'templates'), {
    directories: false,
    globs: ['**/*.hbs']
  }).filter((name: string) => {
    const skipEndings = ['-loading', '-error', '/loading', '/error', 'index', 'application'];
    return !name.startsWith('components/') && skipEndings.filter((ending: string) => name.endsWith(ending + '.hbs')).length === 0;
  });

  const items = [...templatePaths, ...paths].map((filePath: string) => {
    const label = filePath.replace(extname(filePath), '').replace(/\//g, '.');
    return {
      kind: CompletionItemKind.File,
      label,
      detail: 'route'
    };
  });

  return items;
}

export function getComponentNameFromURI(root: string, uri: string) {
  let fileName = uri.replace('file://', '').replace(root, '');
  let splitter = fileName.includes(sep + '-components' + sep)
    ? '/-components/'
    : '/components/';
  let maybeComponentName = fileName
    .split(sep)
    .join('/')
    .split(splitter)[1];

  if (!maybeComponentName) {
    return null;
  }
  return pureComponentName(maybeComponentName);
}
