'use strict';

import { dirname, join } from 'path';
import { uriToFilePath } from 'vscode-languageserver/lib/files';

const walkSync = require('walk-sync');

export class Project {

  public readonly root: string;
  public readonly podRoot: string = '';

  constructor(root: string) {

    let env = require(join(root, 'config', 'environment.js'))();
    const modulePrefix = env.modulePrefix || '';
    const podModulePrefix = env.podModulePrefix || '';

    this.root = root;
    this.podRoot = podModulePrefix.replace(modulePrefix + '/', '');

  }
}

export default class ProjectRoots {
  workspaceRoot: string;

  projects = new Map<string, Project>();

  async initialize(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;

    const roots = walkSync(workspaceRoot, {
      directories: false,
      globs: ['**/ember-cli-build.js'],
      ignore: [
        '**/.git/**',
        '**/bower_components/**',
        '**/dist/**',
        '**/node_modules/**',
        '**/tmp/**',
      ]
    });

    roots.forEach((rootPath: string) => {
      const fullPath = dirname(join(workspaceRoot, rootPath));
      this.onProjectAdd(fullPath);
    });
  }

  onProjectAdd(path: string) {
    console.log(`Ember CLI project added at ${path}`);
    this.projects.set(path, new Project(path));
  }

  projectForUri(uri: string): Project | undefined {
    let path = uriToFilePath(uri);

    if (!path)
      return;

    let root = (Array.from(this.projects.keys()) || [])
      .filter(root => path!.indexOf(root) === 0)
      .reduce((a, b) => a.length > b.length ? a : b, '');

    return this.projects.get(root);
  }
}
