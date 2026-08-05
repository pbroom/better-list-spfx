import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const expectedProvenance = Object.freeze({
  upstreamRepository: "pbroom/spfx-shared-foundation",
  upstreamCommit: "ae736c6004b3fb3f12d87c73ea04cae16e2652e6",
  upstreamPackage: "@spfx-shared-foundation/monaco-resources",
  upstreamPackageVersion: "0.1.0",
  upstreamSourcePath: "packages/monaco-resources/src/index.ts",
  upstreamSourceSha256:
    "6175a2d4a862db6226d2d91cf64ec58af7ddc8a5aa8b0c8613fc76390996d5ee",
  monacoVersion: "0.55.1",
});

const rootDir = process.cwd();
const sourcePath = path.join(
  rootDir,
  "src/vendor/shared-foundation/monacoResources.ts",
);
const provenancePath = path.join(
  rootDir,
  "src/vendor/shared-foundation/monacoResources.provenance.json",
);

const [source, provenanceText, packageText] = await Promise.all([
  readFile(sourcePath),
  readFile(provenancePath, "utf8"),
  readFile(path.join(rootDir, "package.json"), "utf8"),
]);
const provenance = JSON.parse(provenanceText);
const packageJson = JSON.parse(packageText);
const sourceSha256 = createHash("sha256").update(source).digest("hex");

if (
  typeof provenance !== "object" ||
  provenance === null ||
  Array.isArray(provenance) ||
  !hasExactExpectedValues(provenance, expectedProvenance)
) {
  throw new Error(
    "Shared Foundation Monaco provenance differs from the independently pinned contract.",
  );
}
if (sourceSha256 !== expectedProvenance.upstreamSourceSha256) {
  throw new Error(
    `Vendored Shared Foundation Monaco contract hash drifted: ${sourceSha256}`,
  );
}
if (packageJson.dependencies?.["monaco-editor"] !== expectedProvenance.monacoVersion) {
  throw new Error(
    "Better List's Monaco dependency does not match the Shared Foundation contract pin.",
  );
}

console.log(
  `Verified ${expectedProvenance.upstreamPackage}@${expectedProvenance.upstreamPackageVersion} from ${expectedProvenance.upstreamCommit} with Monaco ${expectedProvenance.monacoVersion}.`,
);

function hasExactExpectedValues(actual, expected) {
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every(
      (key, index) => key === expectedKeys[index] && actual[key] === expected[key],
    )
  );
}
