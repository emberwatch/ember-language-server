import  { basename, join, relative } from 'path';
import { FileInfo, ModuleFileInfo } from './file-info';
import Deferred from './utils/deferred';

const klaw = require('klaw');

const ignoredFolders: string[] = [
  '.git',
  'bower_components',
  'dist',
  'node_modules',
  'tmp',
];

export default class FileIndex {

  readonly root: string;
  readonly files: FileInfo[] = [];

  constructor(root: string) {
    this.root = root;
  }

  public async invalidate() {
    return this.addDirectory(this.root);
  }

  public async addDirectory(dirPath: string) {
    let filter = (it: string) => ignoredFolders.indexOf(basename(it)) === -1;

    let { promise, resolve } = new Deferred<void>();

    klaw(dirPath, { filter })
      .on('data', (item: any) => this.add(item.path))
      .on('end', () => resolve());

    return promise;
  }

  public removeDirectory(dirPath: string) {
    let relativePath = relative(this.root, dirPath);
    this.files
      .filter(it => it.relativePath.indexOf(relativePath) === 0)
      .forEach(it => this.remove(join(this.root, it.relativePath)));
  }

  public add(absolutePath: string): FileInfo | undefined {
    let relativePath = relative(this.root, absolutePath);
    let fileInfo = FileInfo.from(relativePath);
    if (fileInfo) {
      console.log(`add ${relativePath} -> ${fileInfo.containerName}`);
      this.files.push(fileInfo);
    }
    return fileInfo;
  }

  public remove(absolutePath: string): FileInfo | undefined {
    let relativePath = relative(this.root, absolutePath);
    let index = this.files.findIndex(fileInfo => fileInfo.relativePath === relativePath);
    if (index !== -1) {
      let fileInfo = this.files.splice(index, 1)[0];
      console.log(`remove ${relativePath} -> ${fileInfo.containerName}`);
      return fileInfo;
    }
  }

  public byModuleType(type: string) {
    return this.files.filter(it => it instanceof ModuleFileInfo && it.type === type);
  }
}
