import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api';

import type { BetterListMonacoRuntimeAdapter } from '../../../vendor/shared-foundation/monacoResources';
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
 * Dynamically creates the optional Shared Foundation adapter after an approved
 * external-runtime owner has passed its production-build and browser-network
 * evidence gate. The bundled Monaco adapter remains the default.
 *
 * Keep this function out of the normal property-pane path. Dynamic loading
 * avoids carrying inactive external runtime bridge code in the standard Better
 * List bundle.
 */
export async function loadBetterListMonacoResourceAdapter(
  configuration: BetterListMonacoResourceConfiguration
): Promise<SourceEditorMonacoAdapter> {
  const { createBetterListMonacoResourceAdapter } = await import(
    /* webpackChunkName: 'better-list-shared-foundation-monaco' */
    './BetterListMonacoResourceAdapterFactory'
  );
  return createBetterListMonacoResourceAdapter(configuration);
}
