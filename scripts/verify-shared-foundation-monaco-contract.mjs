import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

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

if (provenance.upstreamRepository !== "pbroom/spfx-shared-foundation") {
  throw new Error("Shared Foundation Monaco provenance has an unexpected repository.");
}
if (provenance.upstreamCommit !== "ae736c6004b3fb3f12d87c73ea04cae16e2652e6") {
  throw new Error("Shared Foundation Monaco provenance is not pinned to the merged contract commit.");
}
if (sourceSha256 !== provenance.upstreamSourceSha256) {
  throw new Error(
    `Vendored Shared Foundation Monaco contract hash drifted: ${sourceSha256}`,
  );
}
if (packageJson.dependencies?.["monaco-editor"] !== provenance.monacoVersion) {
  throw new Error(
    "Better List's Monaco dependency does not match the Shared Foundation contract pin.",
  );
}

console.log(
  `Verified ${provenance.upstreamPackage}@${provenance.upstreamPackageVersion} from ${provenance.upstreamCommit} with Monaco ${provenance.monacoVersion}.`,
);
