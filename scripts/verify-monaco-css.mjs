import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const distDir = path.resolve("dist");
const releaseAssetsDir = path.resolve("release", "assets");
const chunkNames = (await readdir(distDir)).filter(
  (name) =>
    name.startsWith("chunk.source-editor-monaco") && name.endsWith(".js"),
);

if (chunkNames.length === 0) {
  throw new Error("Could not find the production Monaco editor chunk.");
}

const bundledSource = (
  await Promise.all(
    chunkNames.map((name) => readFile(path.join(distDir, name), "utf8")),
  )
).join("\n");
const globalImeSelector = /\.monaco-editor\s+\.ime-text-area\s*\{/;
const moduleImeSelector =
  /\.monaco-editor_[a-f0-9]+\s+\.ime-text-area_[a-f0-9]+\s*\{/i;

if (!globalImeSelector.test(bundledSource)) {
  throw new Error(
    "The Monaco editor chunk is missing its global IME textarea selector.",
  );
}
if (moduleImeSelector.test(bundledSource)) {
  throw new Error(
    "The Monaco editor chunk still contains CSS-module-scoped editor selectors.",
  );
}

await Promise.all(
  chunkNames.map(async (name) => {
    const releaseChunk = path.join(releaseAssetsDir, name);
    try {
      await access(releaseChunk);
    } catch {
      throw new Error(
        `The bundled Monaco editor chunk is missing from the flat CDN payload: ${name}`,
      );
    }
  }),
);

console.log(`Verified bundled Monaco CSS and flat CDN payload in ${chunkNames.join(", ")}`);
