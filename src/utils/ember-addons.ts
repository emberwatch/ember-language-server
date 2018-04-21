import * as path from 'path';
import { exists, readJSON } from './file';

async function npmDependencies(projectPath: string): Promise<string[]> {
  try {
    const pgk = await readJSON(path.join(projectPath, 'package.json'));
    return Object.keys(pgk.dependencies || {}).concat(Object.keys(pgk.devDependencies || {}));

  } catch (err) {}

  return [];
}

async function isEmberProject(dependencyPath: string) {
  // Some ember addons exclude ember-cli-build.js in their .npmignore
  return (
    await exists(path.join(dependencyPath, 'ember-cli-build.js'))
    || (await npmDependencies(dependencyPath)).includes('ember-cli')
  );
}

export default async function emberAddons(projectPath: string): Promise<string[]> {

  const dependencies = await npmDependencies(projectPath);

  const dependencyPaths = await Promise.all(
    dependencies.map(async dependencyName => {
      const dependencyPath = path.join(projectPath, 'node_modules', dependencyName);
      const exists = await isEmberProject(dependencyPath);
      if (exists) {
        return dependencyPath;
      }
    })
  );

  return dependencyPaths.filter(dependencyPath => dependencyPath) as string [];
}
