import {
    getPodModulePrefix,
    safeWalkSync,
    resolvePackageRoot,
    getPackageJSON,
    pureComponentName,
    listPodsComponents,
    listComponents,
    listHelpers,
    listRoutes,
    getComponentNameFromURI,
    getProjectInRepoAddonsRoots,
    getProjectAddonsRoots
} from '../../src/utils/layout-helpers';
import { join, sep } from 'path';

describe('definition-helpers', function() {
  describe('getPodModulePrefix()', function() {
    it('return pod relative pod prefix for projects with podModulePrefix in evironment.js', function() {
        expect(getPodModulePrefix(join(__dirname, './../fixtures/pod-project'))).toEqual('pods');
    });
    it('return null for projects without podModulePrefix in evironment.js', function() {
        expect(getPodModulePrefix(join(__dirname, './../fixtures/full-project'))).toEqual(null);
    });
  });

  describe('safeWalkSync()', function() {
    it('return empty array if entry path does not exists', function() {
        expect(safeWalkSync(join(__dirname, './../fixtures/-non-existing-path'), {})).toEqual([]);
    });
  });

  describe('resolvePackageRoot()', function() {
    it('return package root folder', function() {
        expect(resolvePackageRoot(__dirname, 'lodash')).toContain(sep + 'lodash');
    });
  });

  describe('getPackageJSON()', function() {
    it('return package json object', function() {
        expect(getPackageJSON(join(__dirname, './../fixtures/full-project')).name).toEqual('full-project');
    });
  });

  describe('pureComponentName()', function() {
    it('return component name without extension and layout postix', function() {
        expect(pureComponentName('/foo/bar-baz.js')).toEqual('foo/bar-baz');
        expect(pureComponentName('/foo/bar-baz.ts')).toEqual('foo/bar-baz');
        expect(pureComponentName('/foo/bar-baz/component.js')).toEqual('foo/bar-baz');
        expect(pureComponentName('/foo/bar-baz/component.ts')).toEqual('foo/bar-baz');
        expect(pureComponentName('/foo/bar-baz/template.hbs')).toEqual('foo/bar-baz');
        expect(pureComponentName('/foo/bar-baz.hbs')).toEqual('foo/bar-baz');
        expect(pureComponentName('foo/bar-baz.hbs')).toEqual('foo/bar-baz');
    });
  });

  describe('listPodsComponents()', function() {
    it('return expected list of components for pods project', function() {
        const components = listPodsComponents(join(__dirname, './../fixtures/pod-project'));
        expect(components.map(({label}: {label: string}) => label )).toEqual(['foo-bar-js', 'foo-bar-js', 'foo-bar-ts']);
    });
  });

  describe('listComponents()', function() {
    it('return expected list of components for classic project', function() {
        const components = listComponents(join(__dirname, './../fixtures/full-project'));
        expect(components.map(({label}: {label: string}) => label )).toEqual([
            'another-awesome-component',
            'my-awesome-component',
            'another-awesome-component',
            'nested/nested-component'
        ]);
    });
  });

  describe('listHelpers()', function() {
    it('return expected list of helpers for classic project', function() {
        const components = listHelpers(join(__dirname, './../fixtures/full-project'));
        expect(components.map(({label}: {label: string}) => label )).toEqual([
            'some-helper'
        ]);
    });
  });

  describe('listRoutes()', function() {
    it('return expected list of routes for classic project', function() {
        const components = listRoutes(join(__dirname, './../fixtures/full-project'));
        expect(components.map(({label}: {label: string}) => label )).toEqual([
            'angle-completion',
            'definition',
            'test-route',
            'nested.nested-route',
            'test-route'
        ]);
    });
  });

  describe('getComponentNameFromURI()', function() {
    it('return correct component name from component template URI', function() {
        const root = __dirname;
        const uri = 'file://' + join(__dirname, 'components', 'foo-bar', 'template.hbs');
        const component = getComponentNameFromURI(root, uri);
        expect(component).toEqual('foo-bar');
    });
    it('return correct component name from route scoped component template URI', function() {
        const root = __dirname;
        const uri = 'file://' + join(__dirname, 'routes', 'hello', '-components', 'foo-bar.hbs');
        const component = getComponentNameFromURI(root, uri);
        expect(component).toEqual('foo-bar');
    });
    it('return correct component name from route template URI', function() {
        const root = __dirname;
        const uri = 'file://' + join(__dirname, 'templates', 'foo-bar.hbs');
        const component = getComponentNameFromURI(root, uri);
        expect(component).toEqual(null);
    });
  });

  describe('getProjectInRepoAddonsRoots()', function() {
    it('must discover in-repo addons for classic structure', function() {
      const root = join(__dirname, './../fixtures/project-with-in-repo-addons');
      const items = getProjectInRepoAddonsRoots(root);
      expect(items.length).toEqual(1);
    });
  });

  describe('getProjectAddonsRoots()', function() {
    it('must resolve all related to project addons', function() {
      const root = join(__dirname, './../fixtures/full-project');
      const items = getProjectAddonsRoots(root, [], 'hope_modules');
      expect(items.length).toEqual(2);
    });
  });

});
