import {
  BETTER_LIST_MONACO_PROFILE,
  PINNED_MONACO_RUNTIME
} from '../../../vendor/shared-foundation/monacoResources';
import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api';
import type { BetterListMonacoRuntimeAdapter } from '../../../vendor/shared-foundation/monacoResources';
import { createBetterListMonacoResourceAdapter } from './BetterListMonacoResourceAdapterFactory';
import { loadBetterListMonacoResourceAdapter } from './BetterListMonacoResources';

describe('BetterListMonacoResources', () => {
  it('pins Better List to the Shared Foundation Monaco identity and loading profile', () => {
    expect(PINNED_MONACO_RUNTIME).toEqual({ packageName: 'monaco-editor', version: '0.55.1' });
    expect(BETTER_LIST_MONACO_PROFILE).toEqual({
      id: 'better-list-source-workspace-v1',
      languages: ['scss', 'html'],
      loadOrder: ['editor-core', 'editor-api', 'language-contribution']
    });
  });

  it('single-flights the existing SCSS and HTML seams while preserving contract order from immutable URLs', async () => {
    const calls: string[] = [];
    const api = { editor: {} } as unknown as typeof import('monaco-editor/esm/vs/editor/editor.api');
    const runtimeAdapter: BetterListMonacoRuntimeAdapter<typeof Monaco> = {
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
    };
    const configuration = {
      cdnBaseUrl: 'https://private.example.test/tenant',
      manifestUrl:
        'https://private.example.test/tenant/monaco-editor/versions/v0.55.1-ssf.1/deployment-manifest.json',
      manifest: productionManifest(),
      runtimeAdapter
    };
    const adapter = createBetterListMonacoResourceAdapter(configuration);
    const popoutAdapter = createBetterListMonacoResourceAdapter(configuration);

    await expect(Promise.all([
      adapter.load('scss'),
      adapter.load('html'),
      popoutAdapter.load('scss')
    ])).resolves.toEqual([api, api, api]);
    expect(calls).toEqual([
      'prepare:scss',
      'editor-core::https://private.example.test/tenant/monaco-editor/versions/v0.55.1-ssf.1/assets/editor-core.js',
      'editor-api::https://private.example.test/tenant/monaco-editor/versions/v0.55.1-ssf.1/assets/editor-api.js',
      'get-api',
      'language-contribution:scss:https://private.example.test/tenant/monaco-editor/versions/v0.55.1-ssf.1/assets/language-scss.js',
      'language-contribution:html:https://private.example.test/tenant/monaco-editor/versions/v0.55.1-ssf.1/assets/language-html.js',
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

  it('loads the future-only bridge on demand instead of making the property pane construct it', async () => {
    const api = { editor: {} } as unknown as typeof import('monaco-editor/esm/vs/editor/editor.api');
    const adapter = await loadBetterListMonacoResourceAdapter({
      cdnBaseUrl: 'https://private.example.test/tenant',
      manifestUrl:
        'https://private.example.test/tenant/monaco-editor/versions/v0.55.1-ssf.4/deployment-manifest.json',
      manifest: productionManifest('0.55.1-ssf.4'),
      runtimeAdapter: {
        async prepare() {},
        async loadModule(module) {
          return module.kind === 'editor-api' ? api : undefined;
        },
        getApi(editorApiModule) {
          return editorApiModule as typeof api;
        }
      }
    });

    await expect(adapter.load('scss')).resolves.toBe(api);
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

  it('clears a failed profile initialization so a later editor mount can retry cleanly', async () => {
    let attempts = 0;
    const api = { editor: {} } as unknown as typeof import('monaco-editor/esm/vs/editor/editor.api');
    const adapter = createBetterListMonacoResourceAdapter({
      cdnBaseUrl: 'https://private.example.test/tenant',
      manifestUrl:
        'https://private.example.test/tenant/monaco-editor/versions/v0.55.1-ssf.2/deployment-manifest.json',
      manifest: productionManifest('0.55.1-ssf.2'),
      runtimeAdapter: {
        async prepare() {
          attempts += 1;
          if (attempts === 1) throw new Error('Transient preparation failure');
        },
        async loadModule(module) {
          return module.kind === 'editor-api' ? api : undefined;
        },
        getApi(editorApiModule) {
          return editorApiModule as typeof api;
        }
      }
    });

    await expect(adapter.load('scss')).rejects.toThrow('Transient preparation failure');
    await expect(adapter.load('scss')).resolves.toBe(api);
    expect(attempts).toBe(2);
  });

  it('retries a failed language contribution without repeating the shared core and API setup', async () => {
    let languageAttempts = 0;
    const calls: string[] = [];
    const api = { editor: {} } as unknown as typeof import('monaco-editor/esm/vs/editor/editor.api');
    const adapter = createBetterListMonacoResourceAdapter({
      cdnBaseUrl: 'https://private.example.test/tenant',
      manifestUrl:
        'https://private.example.test/tenant/monaco-editor/versions/v0.55.1-ssf.3/deployment-manifest.json',
      manifest: productionManifest('0.55.1-ssf.3'),
      runtimeAdapter: {
        async prepare() {
          calls.push('prepare');
        },
        async loadModule(module) {
          calls.push(module.kind);
          if (module.kind === 'language-contribution') {
            languageAttempts += 1;
            if (languageAttempts === 1) throw new Error('Transient SCSS contribution failure');
          }
          return module.kind === 'editor-api' ? api : undefined;
        },
        getApi(editorApiModule) {
          calls.push('get-api');
          return editorApiModule as typeof api;
        }
      }
    });

    await expect(adapter.load('scss')).rejects.toThrow('Transient SCSS contribution failure');
    await expect(adapter.load('scss')).resolves.toBe(api);
    expect(calls).toEqual([
      'prepare',
      'editor-core',
      'editor-api',
      'get-api',
      'language-contribution',
      'language-contribution'
    ]);
  });
});

function productionManifest(releaseVersion = '0.55.1-ssf.1'): Record<string, unknown> {
  return {
    schemaVersion: 1,
    resource: 'monaco-editor',
    releaseVersion,
    releaseKind: 'production',
    productionReady: true,
    runtime: { packageName: 'monaco-editor', version: '0.55.1' },
    profile: 'better-list-source-workspace-v1',
    immutableBasePath: `/monaco-editor/versions/v${releaseVersion}/`,
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
