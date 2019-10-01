import * as path from 'path';
import * as fs from 'fs';
import {
  Location,
  Range
} from 'vscode-languageserver';

import { URI } from 'vscode-uri';

import {
  getPodModulePrefix,
  hasAddonFolderInPath,
  getProjectAddonsRoots,
  getProjectInRepoAddonsRoots
} from './layout-helpers';

export function pathsToLocations(...paths: string[]): Location[] {
  return paths.filter(fs.existsSync).map(modulePath => {
    return Location.create(
      URI.file(modulePath).toString(),
      Range.create(0, 0, 0, 0)
    );
  });
}

export function getFirstTextPostion(text: string, content: string) {
  const arrayOfLines = text.match(/(.*?(?:\r\n?|\n|$))/gm) || [];
  let startLine = 0;
  let startCharacter = 0;
  arrayOfLines.forEach((line: string, index: number) => {
    if (startLine || startCharacter) {
      return;
    }
    let textPosition = line.indexOf(content);
    let bounds = line.split(content);
    if (textPosition > -1) {
      if (
        /\s/.test(bounds[0].charAt(bounds[0].length - 1)) ||
        bounds[0].trim().length === 0
      ) {
        if (/^[A-Za-z]+$/.test(bounds[1].charAt(0)) === false) {
          startLine = index;
          startCharacter = textPosition;
        }
      }
    }
  });
  return [startLine, startCharacter];
}

export function pathsToLocationsWithPosition(paths: string[], findMe: string) {
  return paths.filter(fs.existsSync).map((fileName: string) => {
    const text = fs.readFileSync(fileName, 'utf8');
    const [startLine, startCharacter] = getFirstTextPostion(text, findMe);
    return Location.create(
      URI.file(fileName).toString(),
      Range.create(
        startLine,
        startCharacter,
        startLine,
        startCharacter + findMe.length
      )
    );
  });
}

export function getAbstractHelpersParts(
  root: string,
  prefix: string,
  maybeComponentName: string
) {
  return [
    [root, prefix, 'helpers', `${maybeComponentName}.js`],
    [root, prefix, 'helpers', `${maybeComponentName}.ts`]
  ];
}

export function getAbstractParts(
  root: string,
  prefix: string,
  collection: string,
  name: string
): (string | undefined)[][] {
  return [
    [root, prefix, collection, `${name}.js`],
    [root, prefix, collection, `${name}.ts`]
  ];
}

type LocationPathParts = [string, string, string, string];

function getAbstractPartsWithTemplates([
  root,
  prefix,
  collection,
  name
]: Partial<LocationPathParts>): Partial<LocationPathParts>[] {
  return [
    [root, prefix, collection, `${name}.js`],
    [root, prefix, collection, `${name}.ts`],
    [root, prefix, collection, `${name}.hbs`]
  ];
}

export function getAbstractComponentScriptsParts(
  root: string,
  prefix: string,
  maybeComponentName: string
) {
  return [
    [root, prefix, 'components', maybeComponentName + '.js'],
    [root, prefix, 'components', maybeComponentName + '.ts'],
    [root, prefix, 'components', maybeComponentName, 'component.js'],
    [root, prefix, 'components', maybeComponentName, 'component.ts']
  ];
}

export function getAbstractComponentTemplatesParts(
  root: string,
  prefix: string,
  maybeComponentName: string
) {
  return [
    [root, prefix, 'components', maybeComponentName, 'template.hbs'],
    [root, prefix, 'templates', 'components', maybeComponentName + '.hbs']
  ];
}

export function getPathsForComponentScripts(
  root: string,
  maybeComponentName: string
): string[] {
  const classicComponentsScriptsParts = getAbstractComponentScriptsParts(
    root,
    'app',
    maybeComponentName
  );

  const podModulePrefix = getPodModulePrefix(root);
  const podComponentsScriptsParts = podModulePrefix
    ? getAbstractComponentScriptsParts(
        root,
        'app/' + podModulePrefix,
        maybeComponentName
      )
    : [];

  return [...podComponentsScriptsParts, ...classicComponentsScriptsParts].map(
    pathParts => path.join(...pathParts.filter(part => !!part))
  );
}

export function getPathsForComponentTemplates(
  root: string,
  maybeComponentName: string
): string[] {
  const classicComponentsScriptsParts = getAbstractComponentTemplatesParts(
    root,
    'app',
    maybeComponentName
  );

  const podModulePrefix = getPodModulePrefix(root);
  const podComponentsScriptsParts = podModulePrefix
    ? getAbstractComponentTemplatesParts(
        root,
        'app' + path.sep + podModulePrefix,
        maybeComponentName
      )
    : [];

  return [...podComponentsScriptsParts, ...classicComponentsScriptsParts].map(
    pathParts => path.join(...pathParts.filter(part => !!part))
  );
}

export function getAddonImport(root: string, importPath: string): string[] {
  let importParts = importPath.split('/');
  let addonName = importParts.shift();
  if (addonName && addonName.startsWith('@')) {
    addonName = addonName + path.sep + importParts.shift();
  }

  if (!addonName) {
    return [];
  }

  const roots = [
    ...getProjectAddonsRoots(root),
    ...getProjectInRepoAddonsRoots(root)
  ];

  let existingPaths: string[] = [];
  for (const rootPath in roots) {
    // TODO: fix types here -- I'm pretty sure this is actually a *lie*.
    const possibleLocations: LocationPathParts[] = [
      [rootPath, 'app', ...importParts] as LocationPathParts,
      [rootPath, 'addon', ...importParts] as LocationPathParts,
      [rootPath, ...importParts] as LocationPathParts
    ];

    // TODO: convert to a simple flatMap once on sufficiently recent Node (11+)
    const pathsOnDisk = possibleLocations.reduce(
      (paths, locations) => {
        const pathParts = getAbstractPartsWithTemplates(locations);

        // Cast b/c TS doesn't understand that the tuple of undefined items is
        // to treat as a list of strings after filtering.
        const validPathParts = pathParts.filter(part => !!part) as unknown as LocationPathParts;

        const actualPath = path.join(...validPathParts);
        if (fs.existsSync(actualPath)) {
          paths.push();
        }

        return paths;
      },
      [] as string[]
    );

    if (pathsOnDisk.length) {
      existingPaths = pathsOnDisk;
      break;
    }
  }

  const addonFolderFiles = existingPaths.filter(hasAddonFolderInPath);
  return addonFolderFiles.length > 0 ? addonFolderFiles : existingPaths;
}

// To use as an argument to `reduce` functions. Note that this *mutates* the
// `paths` array passed in, but with the same effect as creating a new array.
function toFilesOnDisk(paths: string[], pathParts: (string | undefined)[]): string[] {
  // This eliminates `null` and `undefined` but also `""`.
  const validPathParts = pathParts.filter(part => !!part) as string[];
  const actualPath = path.join(...validPathParts);
  if (fs.existsSync(actualPath)) {
    paths.push(actualPath);
  }
  return paths;
}

export function getAddonPathsForType(root: string, collection: 'services' | 'models' | 'modifiers' | 'helpers' | 'routes', name: string) {
  const roots = [
    ...getProjectAddonsRoots(root),
    ...getProjectInRepoAddonsRoots(root)
  ];

  let existingPaths: string[] = [];
  for (const rootPath in roots) {
    // NOTE: the inline cast on `reduce` is required to specify the overload it
    // should resolve to. Without it, it tries to resolve as returning the same
    // type as it receives, rather than a new type.
    const pathsOnDisk = [
      ...getAbstractParts(rootPath, 'app', collection, name),
      ...getAbstractParts(rootPath, 'addon', collection, name)
    ].reduce<string[]>(toFilesOnDisk, []);

    if (pathsOnDisk.length) {
      existingPaths = pathsOnDisk;
      break;
    }
  }

  const addonFolderFiles = existingPaths.filter(hasAddonFolderInPath);
  return addonFolderFiles.length > 0 ? addonFolderFiles : existingPaths;
}

export function getAddonPathsForComponentTemplates(
  root: string,
  maybeComponentName: string
) {
  const roots = [
    ...getProjectAddonsRoots(root),
    ...getProjectInRepoAddonsRoots(root),
  ];

  let existingPaths: string[] = [];
  for (const rootPath in roots) {
    const addonScriptPathParts = getAbstractComponentScriptsParts(
      rootPath,
      'addon',
      maybeComponentName
    );

    const appScriptPathParts = getAbstractComponentScriptsParts(
      rootPath,
      'app',
      maybeComponentName
    );

    const appTemplatePathParts = getAbstractComponentTemplatesParts(
      rootPath,
      'app',
      maybeComponentName
    );

    const addonTemplatePathParts = getAbstractComponentTemplatesParts(
      rootPath,
      'addon',
      maybeComponentName
    );

    const appHelperPathParts = getAbstractHelpersParts(
      rootPath,
      'app',
      maybeComponentName
    );

    const addonHelperPathParts = getAbstractHelpersParts(
      rootPath,
      'addon',
      maybeComponentName
    );

    const allPathParts = [
      ...addonScriptPathParts,
      ...appScriptPathParts,
      ...appTemplatePathParts,
      ...addonTemplatePathParts,
      ...appHelperPathParts,
      ...addonHelperPathParts,
    ];

    const validPaths = allPathParts.reduce(toFilesOnDisk, []);

    if (validPaths.length) {
      existingPaths = validPaths;
      break;
    }
  }

  const addonFolderFiles = existingPaths.filter(hasAddonFolderInPath);
  if (addonFolderFiles.length) {
    return addonFolderFiles;
  }
  return existingPaths;
}
