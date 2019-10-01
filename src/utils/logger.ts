import { createWriteStream } from 'fs';

const debug = false;
const util = require('util');
const log_file = debug
  ? createWriteStream(__dirname + '/debug.log', { flags: 'w' })
  : null;

export function log(...args: any[]) {
  if (!debug || !log_file) {
    return;
  }
  const output = args
    .map((a: any) => {
      return JSON.stringify(a);
    })
    .join(' ');
  log_file.write('----------------------------------------' + '\r\n');
  log_file.write(util.format(output) + '\r\n');
  log_file.write('----------------------------------------' + '\r\n');
}
