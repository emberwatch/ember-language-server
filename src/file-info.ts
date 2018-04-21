import * as path from 'path';

const i = require('i')();

const extensions = ['.js', '.hbs', '.handlebars'];
const ignoredFiles = ['.eslintrc.js'];

export abstract class FileInfo {
  static from(relativePath: string): FileInfo | undefined {
    let ext = path.extname(relativePath);
    let filename = path.basename(relativePath);
    if (!extensions.includes(ext) || ignoredFiles.includes(filename)) {
      return;
    }

    let expectedRoot = 'app';
    let pathParts = relativePath.split(path.sep);

    if (pathParts[0] === 'node_modules') {
      pathParts = pathParts.slice(2);
      expectedRoot = 'addon';
    }

    let sourceRoot = pathParts[0];

    if (sourceRoot === expectedRoot) {
      if (pathParts.length === 2) {
        // handle files in the source root
        return new MainFileInfo(relativePath, pathParts);
      }

      if (ext === '.hbs') {
        return new TemplateFileInfo(relativePath, pathParts);
      }

      return new ModuleFileInfo(relativePath, pathParts);

    } else if (sourceRoot === 'tests') {
      let type = pathParts[1];
      if (type === 'integration' || type === 'unit') {
        return new ModuleTestFileInfo(relativePath, pathParts, type);
      } else if (type === 'acceptance') {
        return new AcceptanceTestFileInfo(relativePath, pathParts);
      }
    }
  }

  readonly name: string;

  constructor(public readonly relativePath: string) {}

  get containerName(): string | undefined {
    return undefined;
  }
}

export class MainFileInfo extends FileInfo {
  readonly name: string;

  constructor(relativePath: string, pathParts: string[]) {
    super(relativePath);

    this.name = removeExtension(pathParts)[1];
  }

  get containerName(): string {
    return `main:${this.name}`;
  }
}

export class TemplateFileInfo extends FileInfo {
  readonly forComponent: boolean;
  readonly name: string;
  readonly slashName: string;

  constructor(relativePath: string, pathParts: string[]) {
    super(relativePath);

    this.forComponent = (pathParts[2] === 'components');

    let nameParts = removeExtension(pathParts.slice(this.forComponent ? 3 : 2));
    this.name = nameParts.join('.');
    this.slashName = nameParts.join('/');
  }
}

export class ModuleFileInfo extends FileInfo {
  readonly type: string;
  readonly name: string;
  readonly slashName: string;

  constructor(relativePath: string, pathParts: string[]) {
    super(relativePath);

    let topLevelDirectory = pathParts[1];
    this.type = i.singularize(topLevelDirectory);

    let nameParts = removeExtension(pathParts.slice(2));
    this.name = nameParts.join('.');
    this.slashName = nameParts.join('/');
  }

  get containerName(): string {
    return `${this.type}:${this.name}`;
  }
}

export abstract class TestFileInfo extends FileInfo {}

export class ModuleTestFileInfo extends TestFileInfo {
  readonly subjectType: string;
  readonly name: string;
  readonly slashName: string;

  constructor(relativePath: string, pathParts: string[], public readonly type: string) {
    super(relativePath);

    let topLevelDirectory = pathParts[2];
    this.subjectType = i.singularize(topLevelDirectory);

    let nameParts = removeExtension(pathParts.slice(3));
    this.name = nameParts.join('.');
    this.slashName = nameParts.join('/');
  }
}

export class AcceptanceTestFileInfo extends TestFileInfo {
  readonly name: string;
  readonly slashName: string;

  constructor(relativePath: string, pathParts: string[]) {
    super(relativePath);

    let nameParts = removeExtension(pathParts.slice(2));
    this.name = nameParts.join('.');
    this.slashName = nameParts.join('/');
  }
}

function removeExtension(nameParts: string[]) {
  if (nameParts.length < 1) {
    return [];
  }

  let baseName = nameParts.pop() as string;
  let extension = path.extname(baseName);
  nameParts.push(baseName.substr(0, baseName.length - extension.length));
  return nameParts;
}
