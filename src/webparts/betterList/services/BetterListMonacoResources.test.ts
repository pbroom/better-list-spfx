import {
  BETTER_LIST_MONACO_PROFILE,
  PINNED_MONACO_RUNTIME
} from '../../../vendor/shared-foundation/monacoResources';
import type { BetterListMonacoRuntimeAdapter } from '../../../vendor/shared-foundation/monacoResources';
import { createBetterListMonacoResourceAdapter } from './BetterListMonacoResources';

describe('BetterListMonacoResources', () => {
  it('pins Better List to the Shared Foundation Monaco identity and loading profile', () => {
    expect(PINNED_MONACO_RUNTIME).toEqual({ packageName: 'monaco-editor', version: '0.55.1' });
    expect(BETTER_LIST_MONACO_PROFILE).toEqual({
      id: 'better-list-source-workspace-v1',
      languages: ['scss', 'html'],
      loadOrder: ['editor-core', 'editor-api', 'language-contribution']
    });
  });

  it('loads the existing SCSS and HTML seams in the contract order from immutable URLs', async () => {
    const calls: string[] = [];
    const api = { editor: {} } as unknown as typeof import('monaco-editor/esm/vs/editor/editor.api');
    const adapter = createBetterListMonacoResourceAdapter({
      cdnBaseUrl: 'https://private.example.test/tenant',
      manifestUrl:
        'https://private.example.test/tenant/monaco-editor/versions/v0.55.1-ssf.1/deployment-manifest.json',
      manifest: productionManifest(),
      runtimeAdapter: {
        async prepare(context) {
          calls.push(`prepare:${context.language}`);
          expect(context.styleUrls).toEqual([
            'https://private.example.test/tenant/monaco-editor/versions/v0.55.1-ssf.1/assets/editor.css'
          ]);
          expect(context.workerUrls).toEqual({
            css: 'https://private.example.test/tenant/monaco-editor/versions/v0.55.1-ssf.1/assets/css-worker.js'
          });
        },
        async loadModule(module) {
          calls.push(`${module.kind}:${module.language || ''}:${module.url}`);
          return module.kind === 'editor-api' ? api : undefined;
        },
        getApi(editorApiModule) {
          calls.push('get-api');
          return editorApiModule as typeof api;
        }
      }
    });

    await expect(adapter.load('scss')).resolves.toBe(api);
    await expect(adapter.load('html')).resolves.toBe(api);
    expect(calls).toEqual([
      'prepare:scss',
      'editor-core::https://private.example.test/tenant/monaco-editor/versions/v0.55.1-ssf.1/assets/editor-core.js',
      'editor-api::https://private.example.test/tenant/monaco-editor/versions/v0.55.1-ssf.1/assets/editor-api.js',
      'language-contribution:scss:https://private.example.test/tenant/monaco-editor/versions/v0.55.1-ssf.1/assets/language-scss.js',
      'get-api',
      'prepare:html',
      'editor-core::https://private.example.test/tenant/monaco-editor/versions/v0.55.1-ssf.1/assets/editor-core.js',
      'editor-api::https://private.example.test/tenant/monaco-editor/versions/v0.55.1-ssf.1/assets/editor-api.js',
      'language-contribution:html:https://private.example.test/tenant/monaco-editor/versions/v0.55.1-ssf.1/assets/language-html.js',
      'get-api'
    ]);
  });

  it('rejects the non-production fixture before external loading can begin', () => {
    const prepare = jest.fn();
    expect(() =>
      createBetterListMonacoResourceAdapter({
        cdnBaseUrl: 'https://private.example.test/tenant',
        manifestUrl:
          'https://private.example.test/tenant/monaco-editor/versions/v0.55.1-fixture.1/deployment-manifest.json',
        manifest: fixtureManifest(),
        runtimeAdapter: {
          async prepare() {
            prepare();
          },
          async loadModule() {
            return undefined;
          },
          getApi() {
            return {} as never;
          }
        }
      })
    ).toThrow('Fixture Monaco manifests cannot be loaded as a runtime.');
    expect(prepare).not.toHaveBeenCalled();
  });

  it('rejects a configured manifest URL outside the resolved immutable release', () => {
    expect(() =>
      createBetterListMonacoResourceAdapter({
        cdnBaseUrl: 'https://private.example.test/tenant',
        manifestUrl: 'https://private.example.test/tenant/monaco-editor/latest/deployment-manifest.json',
        manifest: productionManifest(),
        runtimeAdapter: inertRuntimeAdapter()
      })
    ).toThrow('Configured Monaco manifest URL does not match the immutable Shared Foundation release.');
  });

  it('does not switch to bundled Monaco after a partial external load failure', async () => {
    const adapter = createBetterListMonacoResourceAdapter({
      cdnBaseUrl: 'https://private.example.test/tenant',
      manifestUrl:
        'https://private.example.test/tenant/monaco-editor/versions/v0.55.1-ssf.1/deployment-manifest.json',
      manifest: productionManifest(),
      runtimeAdapter: {
        async prepare() {},
        async loadModule(module) {
          if (module.kind === 'editor-api') throw new Error('External module failed integrity verification');
          return undefined;
        },
        getApi() {
          return {} as never;
        }
      }
    });

    await expect(adapter.load('scss')).rejects.toThrow('External module failed integrity verification');
  });
});

function productionManifest(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    resource: 'monaco-editor',
    releaseVersion: '0.55.1-ssf.1',
    releaseKind: 'production',
    productionReady: true,
    runtime: { packageName: 'monaco-editor', version: '0.55.1' },
    profile: 'better-list-source-workspace-v1',
    immutableBasePath: '/monaco-editor/versions/v0.55.1-ssf.1/',
    access: 'authenticated',
    sourceMaps: false,
    checksumAlgorithm: 'sha256',
    entrypoints: {
      editorCore: 'assets/editor-core.js',
      editorApi: 'assets/editor-api.js',
      languages: { scss: 'assets/language-scss.js', html: 'assets/language-html.js' },
      styles: ['assets/editor.css']
    },
    workers: [{ label: 'css', path: 'assets/css-worker.js' }],
    closureEvidence: {
      betterListCommit: '1'.repeat(40),
      buildProvenanceSha256: '2'.repeat(64),
      networkCaptureSha256: '3'.repeat(64)
    },
    files: [
      manifestFile('assets/editor-core.js', 'module', 'text/javascript', 'a'),
      manifestFile('assets/editor-api.js', 'module', 'text/javascript', 'b'),
      manifestFile('assets/language-scss.js', 'module', 'text/javascript', 'c'),
      manifestFile('assets/language-html.js', 'module', 'text/javascript', 'd'),
      manifestFile('assets/editor.css', 'style', 'text/css', 'e'),
      manifestFile('assets/css-worker.js', 'worker', 'text/javascript', 'f')
    ]
  };
}

function fixtureManifest(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    resource: 'monaco-editor',
    releaseVersion: '0.55.1-fixture.1',
    releaseKind: 'fixture',
    productionReady: false,
    runtime: { packageName: 'monaco-editor', version: '0.55.1' },
    profile: 'better-list-source-workspace-v1',
    immutableBasePath: '/monaco-editor/versions/v0.55.1-fixture.1/',
    access: 'authenticated',
    sourceMaps: false,
    checksumAlgorithm: 'sha256',
    entrypoints: { editorCore: null, editorApi: null, languages: { scss: null, html: null }, styles: [] },
    workers: [],
    closureEvidence: null,
    files: [manifestFile('fixture/NON_PRODUCTION_PLACEHOLDER.txt', 'fixture', 'text/plain', 'a')]
  };
}

function manifestFile(path: string, role: string, mediaType: string, digest: string): Record<string, unknown> {
  return { path, role, mediaType, bytes: 1, sha256: digest.repeat(64) };
}

function inertRuntimeAdapter(): BetterListMonacoRuntimeAdapter<
  typeof import('monaco-editor/esm/vs/editor/editor.api')
> {
  return {
    async prepare() {},
    async loadModule() {
      return undefined;
    },
    getApi() {
      return {} as never;
    }
  };
}
