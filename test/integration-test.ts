import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

import { createMessageConnection, MessageConnection, Logger, IPCMessageReader, IPCMessageWriter } from 'vscode-jsonrpc';
import {
  DidOpenTextDocumentNotification,
  InitializeRequest,
  CompletionRequest,
  DefinitionRequest,
  Definition,
  TextDocumentPositionParams
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
      text: fs.readFileSync(filePath, 'utf8')
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

function normalizeUri(objects: Definition) {
  if (!Array.isArray(objects)) {
    objects.uri = replaceDynamicUriPart(objects.uri);
    return objects;
  }

  return objects.map(object => {
    if (object.uri) {
      const { uri } = object;
      object.uri = replaceDynamicUriPart(object.uri);
    }

    return object;
  });
}

function createParams(path: string, line: number, column: number): TextDocumentPositionParams {
  return {
    textDocument: {
      uri: `file://${path}`
    },
    position: {
      line,
      character: column
    }
  };
}

describe('integration', function() {
  let connection: MessageConnection;
  let serverProcess: cp.ChildProcess;

  async function getDefinition(path: string, line: number, column: number) {
    openFile(connection, path);

    let params = createParams(path, line, column);
    let definition = await connection.sendRequest(DefinitionRequest.type, params);

    return normalizeUri(definition);
  }

  async function getCompletion(path: string, line: number, column: number) {
    openFile(connection, path);

    let params = createParams(path, line, column);

    return await connection.sendRequest(CompletionRequest.type, params);
  }

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

  describe('Classic App Structure', () => {
    // This test actually needs to be run first,
    // otherwise the project won't have been initialized and the following tests will fail.
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

        let response = await getCompletion(applicationTemplatePath, 1, 2);

        expect(response).toMatchSnapshot();
      });

      it('returns all routes when requesting completion items in an inline link-to', async () => {
        const templatePath = path.join(__dirname, 'fixtures', 'full-project', 'app', 'templates', 'definition.hbs');

        let response = await getCompletion(templatePath, 2, 23);

        expect(response).toMatchSnapshot();
      });

      it('returns all routes when requesting completion items in a block link-to', async () => {
        const templatePath = path.join(__dirname, 'fixtures', 'full-project', 'app', 'templates', 'definition.hbs');

        let response = await getCompletion(templatePath, 3, 12);

        expect(response).toMatchSnapshot();
      });
    });

    describe('Definition request', () => {
      it('returns the definition information for a component in a template', async () => {
        const definitionTemplatePath = path.join(__dirname, 'fixtures', 'full-project', 'app', 'templates', 'definition.hbs');

        let response = await getDefinition(definitionTemplatePath, 0, 4);

        expect(response).toMatchSnapshot();
      });

      it('returns the definition information for a helper in a template', async () => {
        const definitionTemplatePath = path.join(__dirname, 'fixtures', 'full-project', 'app', 'templates', 'definition.hbs');

        let response = await getDefinition(definitionTemplatePath, 1, 4);

        expect(response).toMatchSnapshot();
      });

      it('returns the definition information for a hasMany relationship', async () => {
        const modelPath = path.join(__dirname, 'fixtures', 'full-project', 'app', 'models', 'model-a.js');

        let response = await getDefinition(modelPath, 4, 27);

        expect(response).toMatchSnapshot();
      });

      it('returns the definition information for a belongsTo relationship', async () => {
        const modelPath = path.join(__dirname, 'fixtures', 'full-project', 'app', 'models', 'model-b.js');

        let response = await getDefinition(modelPath, 4, 27);

        expect(response).toMatchSnapshot();
      });

      it('returns the definition information for a transform', async () => {
        const modelPath = path.join(__dirname, 'fixtures', 'full-project', 'app', 'models', 'model-a.js');

        let response = await getDefinition(modelPath, 6, 27);

        expect(response).toMatchSnapshot();
      });
    });
  });

  describe('Pods App Structure', () => {
    let projectRoot = [__dirname, 'fixtures', 'pod-project'];
    let podRoot = [...projectRoot, 'app', 'pod-dir'];

    describe('Pods Initialize request', () => {
      it('returns an initialize request', async () => {
        const params = {
          rootUri: `file://${path.join(...projectRoot)}`,
          capabilities: {}
        };

        const response = await connection.sendRequest(InitializeRequest.type, params);

        expect(response).toMatchSnapshot();
      });
    });

    describe('Completion request', () => {
      it('returns all components and helpers when requesting completion items in a handlebars expression', async () => {
        const templatePath = path.join(...podRoot, 'foo', 'template.hbs');

        let response = await getCompletion(templatePath, 1, 2);

        expect(response).toMatchSnapshot();
      });

      it('returns all routes when requesting completion items in an inline link-to', async () => {
        const templatePath = path.join(...podRoot, 'components', 'test-component', 'template.hbs');

        let response = await getCompletion(templatePath, 2, 23);

        expect(response).toMatchSnapshot();
      });

      it('returns all routes when requesting completion items in a block link-to', async () => {
        const templatePath = path.join(...podRoot, 'components', 'test-component', 'template.hbs');

        let response = await getCompletion(templatePath, 3, 13);

        expect(response).toMatchSnapshot();
      });
    });

    describe('Definition request', () => {
      it('returns the definition information for a component in a template', async () => {
        const definitionTemplatePath = path.join(...podRoot, 'components', 'test-component', 'template.hbs');

        let response = await getDefinition(definitionTemplatePath, 0, 4);

        expect(response).toMatchSnapshot();
      });

      it('returns the definition information for a nested component in a template', async () => {
        const definitionTemplatePath = path.join(...podRoot, 'components', 'test-component', 'template.hbs');

        let response = await getDefinition(definitionTemplatePath, 1, 4);

        expect(response).toMatchSnapshot();
      });

      it('returns the definition information for a hasMany relationship', async () => {
        const modelPath = path.join(...podRoot, 'foo', 'model.js');

        let response = await getDefinition(modelPath, 4, 22);

        expect(response).toMatchSnapshot();
      });

      it('returns the definition information for a belongsTo relationship', async () => {
        const modelPath = path.join(...podRoot, 'bar', 'model.js');

        let response = await getDefinition(modelPath, 4, 24);

        expect(response).toMatchSnapshot();
      });
    });
  });
});
