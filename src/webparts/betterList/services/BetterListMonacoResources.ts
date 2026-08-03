import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api';

import {
  createBetterListMonacoLoader,
  parseMonacoResourceManifest,
  resolveMonacoResource
} from '../../../vendor/shared-foundation/monacoResources';
import type {
  BetterListMonacoRuntimeAdapter,
  MonacoResourceManifestV1
} from '../../../vendor/shared-foundation/monacoResources';
import type { SourceEditorMonacoAdapter } from '../../../vendor/source-editor/SourceEditorField';

export interface BetterListMonacoResourceConfiguration {
  /** Exact authenticated manifest URL whose verified JSON is supplied below. */
  manifestUrl: string;
  /** Stable private-CDN base URL used to resolve the manifest's immutable release root. */
  cdnBaseUrl: string;
  /** Authenticated, checksum-verified manifest JSON. Fetching and verification remain application-owned. */
  manifest: unknown;
  /** Browser loader for already-verified modules, styles, and workers declared by the manifest. */
  runtimeAdapter: BetterListMonacoRuntimeAdapter<typeof Monaco>;
}

/**
 * Creates the optional Shared Foundation adapter used by Better List's existing
 * source workspace. The bundled Monaco adapter remains the default whenever no
 * adapter is supplied to the property pane.
 *
 * Validation happens before any external runtime code executes. Once a valid
 * external adapter starts loading, failures are allowed to reach the editor's
 * existing textarea fallback instead of mixing partial external state with the
 * bundled Monaco runtime.
 */
export function createBetterListMonacoResourceAdapter(
  configuration: BetterListMonacoResourceConfiguration
): SourceEditorMonacoAdapter {
  const manifest = parseMonacoResourceManifest(configuration.manifest);
  assertConfiguredManifestUrl(configuration.cdnBaseUrl, configuration.manifestUrl, manifest);
  const loader = createBetterListMonacoLoader(
    configuration.cdnBaseUrl,
    manifest,
    configuration.runtimeAdapter
  );
  return Object.freeze({
    load: (language: 'scss' | 'html') => loader.load(language)
  });
}

function assertConfiguredManifestUrl(
  cdnBaseUrl: string,
  configuredManifestUrl: string,
  manifest: MonacoResourceManifestV1
): void {
  const resource = resolveMonacoResource(cdnBaseUrl, manifest);
  if (resource.manifestUrl !== configuredManifestUrl) {
    throw new Error('Configured Monaco manifest URL does not match the immutable Shared Foundation release.');
  }
}
