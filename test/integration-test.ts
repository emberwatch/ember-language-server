import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

import { createMessageConnection, MessageConnection, Logger, IPCMessageReader, IPCMessageWriter } from 'vscode-jsonrpc';
import {
  DidOpenTextDocumentNotification,
  InitializeRequest,
  CompletionRequest,
  DefinitionRequest,
  Location,
  LocationLink,
  Definition,
  DefinitionLink
} from 'vscode-languageserver-protocol';

function startServer() {
  const serverPath = './lib/start-server.js';

  return cp.fork(serverPath, [], {
    cwd: path.join(__dirname, '..')
  });
}

function openFile(connection: MessageConnection, filePath: string) {
  connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {
      uri: `file://${filePath}`,
      text: fs.readFileSync(filePath, 'utf8'),
      languageId: null,
      version: null
    }
  });
}

function replaceDynamicUriPart(uri: string) {
  let dirname = __dirname;
  if (dirname.indexOf(':') === 1) {
    dirname = dirname.substr(2);
  }

  return uri
    .replace(dirname.replace(/\\/g, '/'), '/path-to-tests')
    .replace(dirname, '/path-to-tests')
    .replace(/\\/g, '/');
}

function normalizeUri(objects: Location | Location[] | LocationLink[]) {

  if (!Array.isArray(objects)) {
    objects.uri = replaceDynamicUriPart(objects.uri);
    return objects;
  }

  return (objects as Array<any>).map(object => {
    if ((object as Location).uri) {
      (object as Location).uri = replaceDynamicUriPart((object as Location).uri);
    } else {
      (object as DefinitionLink).targetUri = replaceDynamicUriPart((object as DefinitionLink).targetUri)
    }

    return object;
  });
}

describe('integration', function() {
  let connection: MessageConnection;
  let serverProcess: cp.ChildProcess;

  beforeAll(() => {
    serverProcess = startServer();
    connection = createMessageConnection(
      new IPCMessageReader(serverProcess),
      new IPCMessageWriter(serverProcess),
      <Logger>{
        error(msg) { console.log('error', msg); },
        log(msg) { console.log('log', msg); },
        info(msg) { console.log('info', msg); },
        warn(msg) { console.log('warn', msg); },
      }
    );

    connection.listen();
  });

  afterAll(() => {
    connection.dispose();
    serverProcess.kill();
  });

  describe('Initialize request', () => {
    it('returns an initialize request', async () => {
      const params = {
        rootUri: `file://${path.join(__dirname, 'fixtures', 'full-project')}`,
        capabilities: {}
      };

      const response = await connection.sendRequest(InitializeRequest.type, params);

      expect(response).toMatchSnapshot();
    });
  });

  describe('Completion request', () => {
    it('returns all components and helpers when requesting completion items in a handlebars expression', async () => {
      const applicationTemplatePath = path.join(__dirname, 'fixtures', 'full-project', 'app', 'templates', 'application.hbs');
      const params = {
        textDocument: {
          uri: `file://${applicationTemplatePath}`
        },
        position: {
          line: 1,
          character: 2
        }
      };

      openFile(connection, applicationTemplatePath);

      const response = await connection
        .sendRequest(CompletionRequest.type, params);

      expect(response).toMatchSnapshot();
    });

    it('returns all angle-bracket in a element expression', async () => {
      const applicationTemplatePath = path.join(__dirname, 'fixtures', 'full-project', 'app', 'templates', 'angle-completion.hbs');
      const params = {
        textDocument: {
          uri: `file://${applicationTemplatePath}`
        },
        position: {
          line: 1,
          character: 2
        }
      };

      openFile(connection, applicationTemplatePath);

      const response = await connection
        .sendRequest(CompletionRequest.type, params);

      expect(response).toMatchSnapshot();
    });

    it('returns all routes when requesting completion items in an inline link-to', async () => {
      const templatePath = path.join(__dirname, 'fixtures', 'full-project', 'app', 'templates', 'definition.hbs');
      const params = {
        textDocument: {
          uri: `file://${templatePath}`
        },
        position: {
          line: 2,
          character: 23
        }
      };

      openFile(connection, templatePath);

      const response = await connection
        .sendRequest(CompletionRequest.type, params);

      expect(response).toMatchSnapshot();
    });

    it('returns all routes when requesting completion items in a block link-to', async () => {
      const templatePath = path.join(__dirname, 'fixtures', 'full-project', 'app', 'templates', 'definition.hbs');
      const params = {
        textDocument: {
          uri: `file://${templatePath}`
        },
        position: {
          line: 3,
          character: 12
        }
      };

      openFile(connection, templatePath);

      const response = await connection
        .sendRequest(CompletionRequest.type, params);

      expect(response).toMatchSnapshot();
    });
  });

  describe('Definition request', () => {
    it('returns the definition information for a component in a template', async () => {
      const definitionTemplatePath = path.join(__dirname, 'fixtures', 'full-project', 'app', 'templates', 'definition.hbs');
      const params = {
        textDocument: {
          uri: `file://${definitionTemplatePath}`
        },
        position: {
          line: 0,
          character: 4
        }
      };

      openFile(connection, definitionTemplatePath);

      let response = await connection
        .sendRequest(DefinitionRequest.type, params);

      response = normalizeUri(response);
      expect(response).toMatchSnapshot();
    });

    it('returns the definition information for a helper in a template', async () => {
      const definitionTemplatePath = path.join(__dirname, 'fixtures', 'full-project', 'app', 'templates', 'definition.hbs');
      const params = {
        textDocument: {
          uri: `file://${definitionTemplatePath}`
        },
        position: {
          line: 1,
          character: 4
        }
      };

      openFile(connection, definitionTemplatePath);

      let response = await connection
        .sendRequest(DefinitionRequest.type, params);

      response = normalizeUri(response);
      expect(response).toMatchSnapshot();
    });

    it('returns the definition information for a hasMany relationship', async () => {
      const modelPath = path.join(__dirname, 'fixtures', 'full-project', 'app', 'models', 'model-a.js');
      const params = {
        textDocument: {
          uri: `file://${modelPath}`
        },
        position: {
          line: 4,
          character: 27
        }
      };

      openFile(connection, modelPath);

      let response = await connection
        .sendRequest(DefinitionRequest.type, params);

      response = normalizeUri(response);
      expect(response).toMatchSnapshot();
    });

    it('returns the definition information for a belongsTo relationship', async () => {
      const modelPath = path.join(__dirname, 'fixtures', 'full-project', 'app', 'models', 'model-b.js');
      const params = {
        textDocument: {
          uri: `file://${modelPath}`
        },
        position: {
          line: 4,
          character: 27
        }
      };

      openFile(connection, modelPath);

      let response = await connection
        .sendRequest(DefinitionRequest.type, params);

      response = normalizeUri(response);
      expect(response).toMatchSnapshot();
    });

    it('returns the definition information for a transform', async () => {
      const modelPath = path.join(__dirname, 'fixtures', 'full-project', 'app', 'models', 'model-a.js');
      const params = {
        textDocument: {
          uri: `file://${modelPath}`
        },
        position: {
          line: 6,
          character: 27
        }
      };

      openFile(connection, modelPath);

      let response = await connection
        .sendRequest(DefinitionRequest.type, params);

      response = normalizeUri(response);
      expect(response).toMatchSnapshot();
    });
  });
});
