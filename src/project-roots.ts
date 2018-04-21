'use strict';

import { basename, dirname, join } from 'path';
import { EventEmitter } from 'events';

import FileIndex from './file-index';
import emberAddons from './utils/ember-addons';

export class Project {
  readonly fileIndex: FileIndex;

  constructor(public readonly root: string) {
    this.fileIndex = new FileIndex(root);
  }
}

export default class ProjectRoots {
  workspaceRoot: string;

  projects = new Map<string, Project>();

  async initialize(workspaceRoot: string, watcher: EventEmitter) {

    this.workspaceRoot = workspaceRoot;

    let promise = new Promise(resolve => {
      watcher.once('ready', resolve);
    });

    watcher.on('add', (path: string) => {
      if (basename(path) === 'ember-cli-build.js') {
        this.onProjectAdd(dirname(path));
      }

      promise.then(() => {
        let project = this.projectForPath(path);
        if (project) {
          project.fileIndex.add(path);
        }
      });
    });

    watcher.on('change', (path: string) => {
      if (basename(path) === 'package.json') {
        this.onPackageChange(dirname(path));
      }
    });

    watcher.on('unlink', (path: string) => {
      if (basename(path) === 'ember-cli-build.js') {
        this.onProjectDelete(dirname(path));
      }

      promise.then(() => {
        let project = this.projectForPath(path);
        if (project) {
          project.fileIndex.remove(path);
        }
      });
    });

    await promise;
  }

  async onPackageChange(path: string) {

    let project = this.projectForPath(path);
    if (!project) { return; }

    // TODO do this more efficient by only removing or adding addons if needed.
    project.fileIndex.removeDirectory(join(path, 'node_modules'));

    const addonsPaths = await emberAddons(path);

    await Promise.all(addonsPaths.map((dirPath: string) =>
      project!.fileIndex.addDirectory(dirPath))
    );
  }

  async onProjectAdd(projectPath: string) {
    let project = new Project(projectPath);

    const addonsPaths = await emberAddons(projectPath);

    await Promise.all(addonsPaths.map((dirPath: string) =>
      project.fileIndex.addDirectory(dirPath))
    );

    this.projects.set(projectPath, project);
  }

  onProjectDelete(path: string) {
    console.log(`Ember CLI project deleted at ${path}`);
    this.projects.delete(path);
  }

  projectForPath(path: string): Project | undefined {
    let root = (Array.from(this.projects.keys()) || [])
      .filter(root => path.indexOf(root) === 0)
      .reduce((a, b) => a.length > b.length ? a : b, '');

    return this.projects.get(root);
  }
}
