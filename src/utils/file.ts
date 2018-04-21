import { readFile, stat } from 'fs';
import Deferred from './deferred';

export async function exists(filePath: string): Promise<boolean> {
  let { resolve, reject, promise } = new Deferred<boolean>();

  stat(filePath, err => {
    if (err == null) {
      resolve(true);

    } else if (err.code === 'ENOENT') {
      resolve(false);

    } else {
      reject(err.code);
    }
  });

  return promise;
}

export async function readJSON(filePath: string) {
  let { resolve, reject, promise } = new Deferred<any>();

  readFile(filePath, 'utf8', function(err, data) {
    if (err) {
      reject(err);

    } else try {
      resolve(JSON.parse(data));

    } catch (err) {
      reject(err);
    }
  });

  return promise;
}
