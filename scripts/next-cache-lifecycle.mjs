import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const VERSION = "16.2.10";
const SOURCES = [
  ["dist/server/web/spec-extension/unstable-cache.js", "3d58c34619a0e517fcdca94ce2e89de7b404d75c7f79abf9aa22a468eb238c63", "_workasyncstorageexternal.workAsyncStorage"],
  ["dist/esm/server/web/spec-extension/unstable-cache.js", "bf54028ca21ece64b17fd7827765946c2278ce4ea3a0b991b900f4d300cd4ebb", "workAsyncStorage"],
];
const hash = value => createHash("sha256").update(value).digest("hex");
const helper = `
// FSR: retain the existing lookup/refresh/write, never start another request.
function retainFsrCacheWork(workStore, pending) {
    if (!workStore?.isStaticGeneration && typeof workStore?.afterContext?.waitUntil === 'function') {
        // Keep the original promise and its existing error handling untouched.
        // The lifetime-only derivative must not introduce another raw error log.
        workStore.afterContext.after(pending.catch(()=>undefined));
    }
}
`;
function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw new Error("Next lifecycle patch source mismatch.");
  return source.replace(before, after);
}
export function patchedSource(original, storage) {
  let output = replaceOnce(original, "let noStoreFetchIdx = 0;", `let noStoreFetchIdx = 0;${helper}`);
  const stale = "workStore.pendingRevalidates[invocationKey] = revalidationPromise;";
  output = replaceOnce(output, stale, `${stale}\n                                    retainFsrCacheWork(workStore, revalidationPromise);`);
  const write = "workStore.pendingRevalidates[invocationKey] = cacheNewResult(result, incrementalCache, cacheKey, tags, options.revalidate, fetchIdx, fetchUrl);";
  output = replaceOnce(output, write, `${write}\n                    retainFsrCacheWork(workStore, workStore.pendingRevalidates[invocationKey]);`);
  return replaceOnce(output, "return cachedCb;", `return (...args)=>{
        const pending = cachedCb(...args);
        retainFsrCacheWork(${storage}.getStore(), pending);
        return pending;
    };`);
}
export function originalSource(current, storage) {
  let original = current;
    if (current.includes(helper)) {
      original = replaceOnce(original, helper, "");
      original = replaceOnce(original, "\n                                    retainFsrCacheWork(workStore, revalidationPromise);", "");
      original = replaceOnce(original, "\n                    retainFsrCacheWork(workStore, workStore.pendingRevalidates[invocationKey]);", "");
      original = replaceOnce(original, `return (...args)=>{
        const pending = cachedCb(...args);
        retainFsrCacheWork(${storage}.getStore(), pending);
        return pending;
    };`, "return cachedCb;");
    }
  return original;
}
export function applyPatch(nextDirectory, { restore = false } = {}) {
  const installed = JSON.parse(fs.readFileSync(path.join(nextDirectory, "package.json"), "utf8"));
  if (installed.version !== VERSION) throw new Error("Next lifecycle patch requires the reviewed Next 16.2.10 release.");
  // Validate every file before writing any file. Unknown versions, prior edits,
  // or corrupted patches must fail installation instead of drifting.
  const writes = SOURCES.map(([relative, originalHash, storage]) => {
    const filename = path.join(nextDirectory, relative);
    const current = fs.readFileSync(filename, "utf8");
    const original = originalSource(current, storage);
    if (hash(original) !== originalHash) throw new Error("Next lifecycle patch source hash mismatch.");
    const expected = patchedSource(original, storage);
    if (current !== original && current !== expected) throw new Error("Next lifecycle patch is incomplete or modified.");
    const desired = restore ? original : expected;
    return { filename, expected: desired, changed: current !== desired };
  });
  for (const { filename, expected, changed } of writes) if (changed) fs.writeFileSync(filename, expected);
  return writes.some(item => item.changed);
}
export function prepareBuild(root) {
  // Webpack treats node_modules as immutable. An unchanged package version can
  // otherwise reuse an old compiled dependency even after the source is patched.
  // Preserve fetch-cache and every unrelated cache: they may contain warm data.
  // Turbopack build persistence is disabled in this reviewed Next/config pair.
  fs.rmSync(path.join(root, ".next", "cache", "webpack"), { recursive: true, force: true });
}
// A compiled-marker smoke check. Real framework integration tests are also required.
export function verifyBuild(root) {
  const chunks = path.join(root, ".next", "server", "chunks");
  const files = fs.readdirSync(chunks, { recursive: true }).filter(file => file.endsWith(".js"));
  const found = files.some(file => {
    const code = fs.readFileSync(path.join(chunks, file), "utf8");
    return code.includes("pendingRevalidates") && code.includes("afterContext?.waitUntil")
      && code.includes("isStaticGeneration") && code.includes(".catch(()=>");
  });
  if (!found) throw new Error("Built Next cache lifecycle correction was not found. Refusing an unverified build.");
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  if (process.argv.includes("--verify-build")) {
    verifyBuild(root);
    console.log("Found the Next cache lifecycle guard in compiled output.");
  } else {
    const require = createRequire(path.join(root, "package.json"));
    const restore = process.argv.includes("--restore");
    applyPatch(path.dirname(require.resolve("next/package.json")), { restore });
    if (restore || process.argv.includes("--prepare-build")) prepareBuild(root);
    console.log(restore ? "Restored original Next 16.2.10 sources; rebuild before use." : "Verified Next 16.2.10 cache lifecycle correction.");
  }
}
