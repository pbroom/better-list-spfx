export const PINNED_MONACO_RUNTIME = Object.freeze({
  packageName: "monaco-editor" as const,
  version: "0.55.1" as const,
});

export const BETTER_LIST_MONACO_PROFILE = Object.freeze({
  id: "better-list-source-workspace-v1" as const,
  languages: Object.freeze(["scss", "html"] as const),
  loadOrder: Object.freeze([
    "editor-core",
    "editor-api",
    "language-contribution",
  ] as const),
});

export type BetterListMonacoLanguage =
  (typeof BETTER_LIST_MONACO_PROFILE.languages)[number];
export type MonacoReleaseKind = "fixture" | "production";
export type MonacoFileRole =
  | "module"
  | "style"
  | "worker"
  | "support"
  | "fixture";

export interface MonacoManifestFile {
  readonly path: string;
  readonly role: MonacoFileRole;
  readonly mediaType: string;
  readonly bytes: number;
  readonly sha256: string;
}

export interface MonacoManifestEntrypoints {
  readonly editorCore: string | null;
  readonly editorApi: string | null;
  readonly languages: Readonly<Record<BetterListMonacoLanguage, string | null>>;
  readonly styles: readonly string[];
}

export interface MonacoManifestWorker {
  readonly label: string;
  readonly path: string;
}

export interface MonacoClosureEvidence {
  readonly betterListCommit: string;
  readonly buildProvenanceSha256: string;
  readonly networkCaptureSha256: string;
}

export interface MonacoResourceManifestV1 {
  readonly schemaVersion: 1;
  readonly resource: "monaco-editor";
  readonly releaseVersion: string;
  readonly releaseKind: MonacoReleaseKind;
  readonly productionReady: boolean;
  readonly runtime: typeof PINNED_MONACO_RUNTIME;
  readonly profile: typeof BETTER_LIST_MONACO_PROFILE.id;
  readonly immutableBasePath: string;
  readonly access: "authenticated";
  readonly sourceMaps: false;
  readonly checksumAlgorithm: "sha256";
  readonly entrypoints: MonacoManifestEntrypoints;
  readonly workers: readonly MonacoManifestWorker[];
  readonly closureEvidence: MonacoClosureEvidence | null;
  readonly files: readonly MonacoManifestFile[];
}

export interface ProductionMonacoResourceManifestV1
  extends MonacoResourceManifestV1 {
  readonly releaseKind: "production";
  readonly productionReady: true;
  readonly closureEvidence: MonacoClosureEvidence;
}

export interface ResolvedMonacoResource {
  readonly manifest: MonacoResourceManifestV1;
  readonly rootUrl: string;
  readonly manifestUrl: string;
  readonly assetUrl: (assetPath: string) => string;
}

export interface BetterListMonacoLoadModule {
  readonly kind: "editor-core" | "editor-api" | "language-contribution";
  readonly language?: BetterListMonacoLanguage;
  readonly url: string;
}

export interface BetterListMonacoLoadContext {
  readonly language: BetterListMonacoLanguage;
  readonly resource: ResolvedMonacoResource & {
    readonly manifest: ProductionMonacoResourceManifestV1;
  };
  readonly styleUrls: readonly string[];
  readonly workerUrls: Readonly<Record<string, string>>;
}

export interface BetterListMonacoRuntimeAdapter<TMonacoApi> {
  prepare(context: BetterListMonacoLoadContext): Promise<void>;
  loadModule(
    module: BetterListMonacoLoadModule,
    context: BetterListMonacoLoadContext,
  ): Promise<unknown>;
  getApi(
    editorApiModule: unknown,
    context: BetterListMonacoLoadContext,
  ): Promise<TMonacoApi> | TMonacoApi;
}

export interface BetterListMonacoLoader<TMonacoApi> {
  load(language: BetterListMonacoLanguage): Promise<TMonacoApi>;
}

const manifestKeys = [
  "schemaVersion",
  "resource",
  "releaseVersion",
  "releaseKind",
  "productionReady",
  "runtime",
  "profile",
  "immutableBasePath",
  "access",
  "sourceMaps",
  "checksumAlgorithm",
  "entrypoints",
  "workers",
  "closureEvidence",
  "files",
] as const;
const entrypointKeys = [
  "editorCore",
  "editorApi",
  "languages",
  "styles",
] as const;
const languageKeys = ["scss", "html"] as const;
const runtimeKeys = ["packageName", "version"] as const;
const workerKeys = ["label", "path"] as const;
const evidenceKeys = [
  "betterListCommit",
  "buildProvenanceSha256",
  "networkCaptureSha256",
] as const;
const fileKeys = ["path", "role", "mediaType", "bytes", "sha256"] as const;
const fileRoles = new Set<MonacoFileRole>([
  "module",
  "style",
  "worker",
  "support",
  "fixture",
]);
const mutablePathSegments = new Set([
  "latest",
  "current",
  "stable",
  "next",
  "canary",
  "snapshot",
  "dev",
  "head",
  "main",
  "master",
]);
const allowedExtensions = new Set([
  ".css",
  ".js",
  ".json",
  ".png",
  ".svg",
  ".txt",
  ".ttf",
  ".wasm",
  ".woff",
  ".woff2",
]);
const mediaTypesByExtension = new Map([
  [".css", new Set(["text/css"])],
  [".js", new Set(["application/javascript", "text/javascript"])],
  [".json", new Set(["application/json"])],
  [".png", new Set(["image/png"])],
  [".svg", new Set(["image/svg+xml"])],
  [".txt", new Set(["text/plain"])],
  [".ttf", new Set(["font/ttf"])],
  [".wasm", new Set(["application/wasm"])],
  [".woff", new Set(["font/woff"])],
  [".woff2", new Set(["font/woff2"])],
]);
const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const sha256 = /^[a-f0-9]{64}$/;
const commitSha = /^[a-f0-9]{40}$/;

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  ) {
    throw new Error(`${label} contains missing or unexpected fields.`);
  }
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function assertNullablePath(value: unknown, label: string): string | null {
  return value === null
    ? null
    : assertSafeResourcePath(assertString(value, label), label);
}

export function assertSafeResourcePath(value: string, label = "path"): string {
  if (
    value.startsWith("/") ||
    value.includes("\\") ||
    value.includes("?") ||
    value.includes("#") ||
    value.includes("%") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new Error(`${label} must be a canonical relative path.`);
  }
  const segments = value.split("/");
  if (
    segments.some(
      (segment) =>
        segment === "" ||
        segment === "." ||
        segment === ".." ||
        segment.startsWith(".") ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(segment) ||
        mutablePathSegments.has(segment.toLowerCase()),
    )
  ) {
    throw new Error(`${label} contains an unsafe or mutable path segment.`);
  }
  if (value.toLowerCase().endsWith(".map")) {
    throw new Error(`${label} must not reference a source map.`);
  }
  const extensionIndex = value.lastIndexOf(".");
  const extension =
    extensionIndex === -1 ? "" : value.slice(extensionIndex).toLowerCase();
  if (!allowedExtensions.has(extension)) {
    throw new Error(`${label} has an unsupported resource extension.`);
  }
  return value;
}

function parseEntrypoints(value: unknown): MonacoManifestEntrypoints {
  const entrypoints = asRecord(value, "entrypoints");
  assertExactKeys(entrypoints, entrypointKeys, "entrypoints");
  const languages = asRecord(entrypoints.languages, "entrypoints.languages");
  assertExactKeys(languages, languageKeys, "entrypoints.languages");
  if (!Array.isArray(entrypoints.styles)) {
    throw new Error("entrypoints.styles must be an array.");
  }
  return {
    editorCore: assertNullablePath(
      entrypoints.editorCore,
      "entrypoints.editorCore",
    ),
    editorApi: assertNullablePath(
      entrypoints.editorApi,
      "entrypoints.editorApi",
    ),
    languages: {
      scss: assertNullablePath(languages.scss, "entrypoints.languages.scss"),
      html: assertNullablePath(languages.html, "entrypoints.languages.html"),
    },
    styles: entrypoints.styles.map((item, index) =>
      assertSafeResourcePath(
        assertString(item, `entrypoints.styles[${index}]`),
      ),
    ),
  };
}

function parseWorkers(value: unknown): readonly MonacoManifestWorker[] {
  if (!Array.isArray(value)) throw new Error("workers must be an array.");
  const labels = new Set<string>();
  return value.map((item, index) => {
    const worker = asRecord(item, `workers[${index}]`);
    assertExactKeys(worker, workerKeys, `workers[${index}]`);
    const label = assertString(worker.label, `workers[${index}].label`);
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(label) || labels.has(label)) {
      throw new Error(`workers[${index}].label must be safe and unique.`);
    }
    labels.add(label);
    return {
      label,
      path: assertSafeResourcePath(
        assertString(worker.path, `workers[${index}].path`),
        `workers[${index}].path`,
      ),
    };
  });
}

function parseClosureEvidence(value: unknown): MonacoClosureEvidence | null {
  if (value === null) return null;
  const evidence = asRecord(value, "closureEvidence");
  assertExactKeys(evidence, evidenceKeys, "closureEvidence");
  const betterListCommit = assertString(
    evidence.betterListCommit,
    "closureEvidence.betterListCommit",
  );
  const buildProvenanceSha256 = assertString(
    evidence.buildProvenanceSha256,
    "closureEvidence.buildProvenanceSha256",
  );
  const networkCaptureSha256 = assertString(
    evidence.networkCaptureSha256,
    "closureEvidence.networkCaptureSha256",
  );
  if (!commitSha.test(betterListCommit)) {
    throw new Error(
      "closureEvidence.betterListCommit must be a lowercase 40-character Git SHA.",
    );
  }
  if (
    !sha256.test(buildProvenanceSha256) ||
    !sha256.test(networkCaptureSha256)
  ) {
    throw new Error(
      "closureEvidence digests must be lowercase SHA-256 values.",
    );
  }
  return { betterListCommit, buildProvenanceSha256, networkCaptureSha256 };
}

function parseFiles(value: unknown): readonly MonacoManifestFile[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("files must be a non-empty array.");
  }
  const paths = new Set<string>();
  const foldedPaths = new Set<string>();
  return value.map((item, index) => {
    const file = asRecord(item, `files[${index}]`);
    assertExactKeys(file, fileKeys, `files[${index}]`);
    const resourcePath = assertSafeResourcePath(
      assertString(file.path, `files[${index}].path`),
      `files[${index}].path`,
    );
    const foldedPath = resourcePath.toLowerCase();
    if (paths.has(resourcePath) || foldedPaths.has(foldedPath)) {
      throw new Error(
        `files[${index}].path duplicates or case-collides with another file.`,
      );
    }
    paths.add(resourcePath);
    foldedPaths.add(foldedPath);
    const role = assertString(
      file.role,
      `files[${index}].role`,
    ) as MonacoFileRole;
    if (!fileRoles.has(role))
      throw new Error(`files[${index}].role is unsupported.`);
    const mediaType = assertString(file.mediaType, `files[${index}].mediaType`);
    if (!/^[a-z]+\/[a-z0-9.+-]+$/i.test(mediaType)) {
      throw new Error(`files[${index}].mediaType is invalid.`);
    }
    const extension = resourcePath
      .slice(resourcePath.lastIndexOf("."))
      .toLowerCase();
    if (!mediaTypesByExtension.get(extension)?.has(mediaType)) {
      throw new Error(
        `files[${index}].mediaType does not match its file extension.`,
      );
    }
    if (
      ((role === "module" || role === "worker") && extension !== ".js") ||
      (role === "style" && extension !== ".css") ||
      (role === "fixture" && extension !== ".txt")
    ) {
      throw new Error(
        `files[${index}].role does not match its file extension.`,
      );
    }
    if (!Number.isSafeInteger(file.bytes) || (file.bytes as number) <= 0) {
      throw new Error(`files[${index}].bytes must be a positive safe integer.`);
    }
    const digest = assertString(file.sha256, `files[${index}].sha256`);
    if (!sha256.test(digest)) {
      throw new Error(
        `files[${index}].sha256 must be a lowercase SHA-256 value.`,
      );
    }
    return {
      path: resourcePath,
      role,
      mediaType,
      bytes: file.bytes as number,
      sha256: digest,
    };
  });
}

function assertReferencedFile(
  path: string,
  role: MonacoFileRole,
  filesByPath: ReadonlyMap<string, MonacoManifestFile>,
  label: string,
): void {
  const file = filesByPath.get(path);
  if (!file || file.role !== role) {
    throw new Error(
      `${label} must reference a manifest file with role ${role}.`,
    );
  }
}

export function parseMonacoResourceManifest(
  value: unknown,
): MonacoResourceManifestV1 {
  const manifest = asRecord(value, "manifest");
  assertExactKeys(manifest, manifestKeys, "manifest");
  if (manifest.schemaVersion !== 1) throw new Error("schemaVersion must be 1.");
  if (manifest.resource !== "monaco-editor")
    throw new Error("resource must be monaco-editor.");
  const releaseVersion = assertString(
    manifest.releaseVersion,
    "releaseVersion",
  );
  if (!semver.test(releaseVersion))
    throw new Error("releaseVersion must be a SemVer value.");
  if (
    manifest.releaseKind !== "fixture" &&
    manifest.releaseKind !== "production"
  ) {
    throw new Error("releaseKind must be fixture or production.");
  }
  const releaseKind = manifest.releaseKind;
  if (typeof manifest.productionReady !== "boolean") {
    throw new Error("productionReady must be a boolean.");
  }
  const runtime = asRecord(manifest.runtime, "runtime");
  assertExactKeys(runtime, runtimeKeys, "runtime");
  if (
    runtime.packageName !== PINNED_MONACO_RUNTIME.packageName ||
    runtime.version !== PINNED_MONACO_RUNTIME.version
  ) {
    throw new Error(
      "runtime must match the pinned Better List Monaco identity.",
    );
  }
  if (manifest.profile !== BETTER_LIST_MONACO_PROFILE.id) {
    throw new Error(
      "profile must match the Better List source workspace profile.",
    );
  }
  const immutableBasePath = assertString(
    manifest.immutableBasePath,
    "immutableBasePath",
  );
  if (immutableBasePath !== `/monaco-editor/versions/v${releaseVersion}/`) {
    throw new Error(
      "immutableBasePath must exactly match the versioned Monaco release path.",
    );
  }
  if (manifest.access !== "authenticated")
    throw new Error("access must be authenticated.");
  if (manifest.sourceMaps !== false)
    throw new Error("sourceMaps must be false.");
  if (manifest.checksumAlgorithm !== "sha256") {
    throw new Error("checksumAlgorithm must be sha256.");
  }

  const entrypoints = parseEntrypoints(manifest.entrypoints);
  const workers = parseWorkers(manifest.workers);
  const closureEvidence = parseClosureEvidence(manifest.closureEvidence);
  const files = parseFiles(manifest.files);
  const filesByPath = new Map(files.map((file) => [file.path, file]));

  if (releaseKind === "fixture") {
    if (manifest.productionReady !== false || closureEvidence !== null) {
      throw new Error(
        "Fixture manifests must be non-production and omit closure evidence.",
      );
    }
    if (!releaseVersion.includes("fixture")) {
      throw new Error(
        "Fixture releaseVersion must include the fixture marker.",
      );
    }
    if (
      entrypoints.editorCore !== null ||
      entrypoints.editorApi !== null ||
      entrypoints.languages.scss !== null ||
      entrypoints.languages.html !== null ||
      entrypoints.styles.length !== 0 ||
      workers.length !== 0 ||
      files.some(
        (file) => file.role !== "fixture" || !file.path.startsWith("fixture/"),
      )
    ) {
      throw new Error(
        "Fixture manifests must not pretend to contain runtime entrypoints or workers.",
      );
    }
  } else {
    if (manifest.productionReady !== true || closureEvidence === null) {
      throw new Error(
        "Production manifests require production readiness and closure evidence.",
      );
    }
    if (releaseVersion.includes("fixture")) {
      throw new Error(
        "Production releaseVersion must not contain a fixture marker.",
      );
    }
    if (
      entrypoints.editorCore === null ||
      entrypoints.editorApi === null ||
      entrypoints.languages.scss === null ||
      entrypoints.languages.html === null ||
      entrypoints.styles.length === 0
    ) {
      throw new Error(
        "Production manifests require the complete Better List loading profile.",
      );
    }
    if (
      files.some(
        (file) => file.role === "fixture" || file.path.startsWith("fixture/"),
      )
    ) {
      throw new Error("Production manifests must not contain fixture files.");
    }
    assertReferencedFile(
      entrypoints.editorCore,
      "module",
      filesByPath,
      "editorCore",
    );
    assertReferencedFile(
      entrypoints.editorApi,
      "module",
      filesByPath,
      "editorApi",
    );
    assertReferencedFile(
      entrypoints.languages.scss,
      "module",
      filesByPath,
      "SCSS contribution",
    );
    assertReferencedFile(
      entrypoints.languages.html,
      "module",
      filesByPath,
      "HTML contribution",
    );
    for (const style of entrypoints.styles) {
      assertReferencedFile(style, "style", filesByPath, "style entrypoint");
    }
    for (const worker of workers) {
      assertReferencedFile(
        worker.path,
        "worker",
        filesByPath,
        `worker ${worker.label}`,
      );
    }
  }

  const parsedManifest: MonacoResourceManifestV1 = {
    schemaVersion: 1,
    resource: "monaco-editor",
    releaseVersion,
    releaseKind,
    productionReady: manifest.productionReady,
    runtime: PINNED_MONACO_RUNTIME,
    profile: BETTER_LIST_MONACO_PROFILE.id,
    immutableBasePath,
    access: "authenticated",
    sourceMaps: false,
    checksumAlgorithm: "sha256",
    entrypoints,
    workers,
    closureEvidence,
    files,
  };
  Object.freeze(entrypoints.languages);
  Object.freeze(entrypoints.styles);
  Object.freeze(entrypoints);
  workers.forEach(Object.freeze);
  Object.freeze(workers);
  if (closureEvidence) Object.freeze(closureEvidence);
  files.forEach(Object.freeze);
  Object.freeze(files);
  return Object.freeze(parsedManifest);
}

export function assertProductionMonacoManifest(
  manifest: MonacoResourceManifestV1,
): asserts manifest is ProductionMonacoResourceManifestV1 {
  const parsed = parseMonacoResourceManifest(manifest);
  if (parsed.releaseKind !== "production" || parsed.productionReady !== true) {
    throw new Error("Fixture Monaco manifests cannot be loaded as a runtime.");
  }
}

function parseSecureCdnBaseUrl(value: string): URL {
  const match =
    /^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/]*(\/[^?#]*)?(?:[?#].*)?$/.exec(value);
  const rawPath = match?.[1] ?? "/";
  const rawSegments = rawPath
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);
  if (
    !match ||
    value.includes("\\") ||
    value.includes("%") ||
    rawPath.slice(1, -1).includes("//") ||
    rawSegments.some(
      (segment) =>
        segment === "." ||
        segment === ".." ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(segment),
    )
  ) {
    throw new Error("Monaco CDN base URL must use a canonical path.");
  }
  const baseUrl = new URL(value);
  if (baseUrl.protocol !== "https:")
    throw new Error("Monaco CDN base URL must use HTTPS.");
  if (baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    throw new Error(
      "Monaco CDN base URL must not contain credentials, a query, or a fragment.",
    );
  }
  const segments = baseUrl.pathname.split("/").filter(Boolean);
  if (
    segments.some((segment) => mutablePathSegments.has(segment.toLowerCase()))
  ) {
    throw new Error(
      "Monaco CDN base URL must not contain a mutable path segment.",
    );
  }
  return baseUrl;
}

export function resolveMonacoResource(
  cdnBaseUrl: string,
  manifest: MonacoResourceManifestV1,
): ResolvedMonacoResource {
  const parsed = parseMonacoResourceManifest(manifest);
  const baseUrl = parseSecureCdnBaseUrl(cdnBaseUrl);
  const basePath = baseUrl.pathname.replace(/\/+$/, "");
  baseUrl.pathname = `${basePath}${parsed.immutableBasePath}`;
  const rootUrl = baseUrl.toString();
  const root = new URL(rootUrl);
  const manifestPaths = new Set(parsed.files.map((file) => file.path));
  const assetUrl = (assetPath: string): string => {
    const safePath = assertSafeResourcePath(assetPath, "assetPath");
    if (!manifestPaths.has(safePath)) {
      throw new Error(
        `assetPath is not present in the Monaco manifest: ${safePath}`,
      );
    }
    const resolved = new URL(safePath, rootUrl);
    if (
      resolved.origin !== root.origin ||
      !resolved.pathname.startsWith(root.pathname)
    ) {
      throw new Error(
        "Resolved Monaco asset escaped its immutable release root.",
      );
    }
    return resolved.toString();
  };
  return Object.freeze({
    manifest: parsed,
    rootUrl,
    manifestUrl: new URL("deployment-manifest.json", rootUrl).toString(),
    assetUrl,
  });
}

export function createBetterListMonacoLoader<TMonacoApi>(
  cdnBaseUrl: string,
  manifestValue: MonacoResourceManifestV1,
  adapter: BetterListMonacoRuntimeAdapter<TMonacoApi>,
): BetterListMonacoLoader<TMonacoApi> {
  const resource = resolveMonacoResource(cdnBaseUrl, manifestValue);
  assertProductionMonacoManifest(resource.manifest);
  const manifest = resource.manifest;
  const editorCore = manifest.entrypoints.editorCore as string;
  const editorApi = manifest.entrypoints.editorApi as string;
  return {
    async load(language) {
      if (!BETTER_LIST_MONACO_PROFILE.languages.includes(language)) {
        throw new Error(
          `Unsupported Better List Monaco language: ${String(language)}`,
        );
      }
      const languagePath = manifest.entrypoints.languages[language] as string;
      const modules: readonly BetterListMonacoLoadModule[] = [
        { kind: "editor-core", url: resource.assetUrl(editorCore) },
        { kind: "editor-api", url: resource.assetUrl(editorApi) },
        {
          kind: "language-contribution",
          language,
          url: resource.assetUrl(languagePath),
        },
      ];
      const context: BetterListMonacoLoadContext = {
        language,
        resource: resource as BetterListMonacoLoadContext["resource"],
        styleUrls: manifest.entrypoints.styles.map(resource.assetUrl),
        workerUrls: Object.freeze(
          Object.fromEntries(
            manifest.workers.map((worker) => [
              worker.label,
              resource.assetUrl(worker.path),
            ]),
          ),
        ),
      };
      await adapter.prepare(context);
      let editorApiModule: unknown;
      for (const module of modules) {
        const loaded = await adapter.loadModule(module, context);
        if (module.kind === "editor-api") editorApiModule = loaded;
      }
      return adapter.getApi(editorApiModule, context);
    },
  };
}
