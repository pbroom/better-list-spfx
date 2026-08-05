import {
  assertProductionMonacoManifest,
  BETTER_LIST_MONACO_PROFILE,
  parseMonacoResourceManifest,
  resolveMonacoResource
} from '../../../vendor/shared-foundation/monacoResources';
import type {
  BetterListMonacoLanguage,
  BetterListMonacoLoadContext,
  BetterListMonacoLoadModule,
  BetterListMonacoRuntimeAdapter,
  ResolvedMonacoResource
} from '../../../vendor/shared-foundation/monacoResources';
import type { SourceEditorMonacoAdapter } from '../../../vendor/source-editor/SourceEditorField';
import type { BetterListMonacoResourceConfiguration } from './BetterListMonacoResources';

interface ProfileLoadState<TMonacoApi> {
  readonly adapter: BetterListMonacoRuntimeAdapter<TMonacoApi>;
  readonly resource: ResolvedMonacoResource;
  coreApiPromise?: Promise<TMonacoApi>;
  readonly languagePromises: Map<BetterListMonacoLanguage, Promise<TMonacoApi>>;
}

/**
 * Shared loading state is intentionally scoped to one runtime-adapter object and
 * immutable release root. The adapter is the owner of browser-global Monaco
 * resources; distinct owners must not be silently coalesced.
 */
const profileStates = new WeakMap<object, Map<string, ProfileLoadState<unknown>>>();

/**
 * Creates the optional Shared Foundation adapter after the caller has passed
 * the production-build and browser-network evidence gate. The ordinary Better
 * List property pane receives this already-created adapter and never imports
 * this bridge itself.
 */
export function createBetterListMonacoResourceAdapter(
  configuration: BetterListMonacoResourceConfiguration
): SourceEditorMonacoAdapter {
  const manifest = parseMonacoResourceManifest(configuration.manifest);
  assertProductionMonacoManifest(manifest);
  assertConfiguredManifestUrl(configuration.cdnBaseUrl, configuration.manifestUrl, manifest);
  const resource = resolveMonacoResource(configuration.cdnBaseUrl, manifest);
  const state = getOrCreateProfileState(resource, configuration.runtimeAdapter);

  return Object.freeze({
    load: (language: BetterListMonacoLanguage) => loadProfileLanguage(state, language)
  });
}

function getOrCreateProfileState<TMonacoApi>(
  resource: ResolvedMonacoResource,
  adapter: BetterListMonacoRuntimeAdapter<TMonacoApi>
): ProfileLoadState<TMonacoApi> {
  const owner = adapter as unknown as object;
  let states = profileStates.get(owner);
  if (!states) {
    states = new Map<string, ProfileLoadState<unknown>>();
    profileStates.set(owner, states);
  }
  const existing = states.get(resource.manifestUrl) as ProfileLoadState<TMonacoApi> | undefined;
  if (existing) return existing;

  const created: ProfileLoadState<TMonacoApi> = {
    adapter,
    resource,
    languagePromises: new Map<BetterListMonacoLanguage, Promise<TMonacoApi>>()
  };
  states.set(resource.manifestUrl, created as ProfileLoadState<unknown>);
  return created;
}

function loadProfileLanguage<TMonacoApi>(
  state: ProfileLoadState<TMonacoApi>,
  language: BetterListMonacoLanguage
): Promise<TMonacoApi> {
  if (!BETTER_LIST_MONACO_PROFILE.languages.includes(language)) {
    return Promise.reject(new Error(`Unsupported Better List Monaco language: ${String(language)}`));
  }
  const existing = state.languagePromises.get(language);
  if (existing) return existing;

  const loading = loadCoreAndApi(state, language).then(async (api) => {
    await state.adapter.loadModule(languageModule(state.resource, language), createContext(state.resource, language));
    return api;
  });
  state.languagePromises.set(language, loading);
  loading.catch(() => {
    if (state.languagePromises.get(language) === loading) state.languagePromises.delete(language);
  });
  return loading;
}

function loadCoreAndApi<TMonacoApi>(
  state: ProfileLoadState<TMonacoApi>,
  initialLanguage: BetterListMonacoLanguage
): Promise<TMonacoApi> {
  if (state.coreApiPromise) return state.coreApiPromise;

  const context = createContext(state.resource, initialLanguage);
  const loading = (async (): Promise<TMonacoApi> => {
    await state.adapter.prepare(context);
    await state.adapter.loadModule(coreModule(state.resource), context);
    const editorApiModule = await state.adapter.loadModule(apiModule(state.resource), context);
    return state.adapter.getApi(editorApiModule, context);
  })();
  state.coreApiPromise = loading;
  loading.catch(() => {
    if (state.coreApiPromise === loading) state.coreApiPromise = undefined;
  });
  return loading;
}

function createContext(
  resource: ResolvedMonacoResource,
  language: BetterListMonacoLanguage
): BetterListMonacoLoadContext {
  const manifest = resource.manifest;
  assertProductionMonacoManifest(manifest);
  return {
    language,
    resource: resource as BetterListMonacoLoadContext['resource'],
    styleUrls: manifest.entrypoints.styles.map(resource.assetUrl),
    workerUrls: Object.freeze(
      Object.fromEntries(manifest.workers.map((worker) => [worker.label, resource.assetUrl(worker.path)]))
    )
  };
}

function coreModule(resource: ResolvedMonacoResource): BetterListMonacoLoadModule {
  const core = resource.manifest.entrypoints.editorCore;
  if (!core) throw new Error('Production Monaco manifest is missing editor core.');
  return { kind: 'editor-core', url: resource.assetUrl(core) };
}

function apiModule(resource: ResolvedMonacoResource): BetterListMonacoLoadModule {
  const api = resource.manifest.entrypoints.editorApi;
  if (!api) throw new Error('Production Monaco manifest is missing editor API.');
  return { kind: 'editor-api', url: resource.assetUrl(api) };
}

function languageModule(
  resource: ResolvedMonacoResource,
  language: BetterListMonacoLanguage
): BetterListMonacoLoadModule {
  const contribution = resource.manifest.entrypoints.languages[language];
  if (!contribution) throw new Error(`Production Monaco manifest is missing ${language} support.`);
  return { kind: 'language-contribution', language, url: resource.assetUrl(contribution) };
}

function assertConfiguredManifestUrl(
  cdnBaseUrl: string,
  configuredManifestUrl: string,
  manifest: Parameters<typeof resolveMonacoResource>[1]
): void {
  const resource = resolveMonacoResource(cdnBaseUrl, manifest);
  if (resource.manifestUrl !== configuredManifestUrl) {
    throw new Error('Configured Monaco manifest URL does not match the immutable Shared Foundation release.');
  }
}
