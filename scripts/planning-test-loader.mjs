import fs from "node:fs";
import ts from "typescript";

// Compile the real pure TypeScript modules, including their relative dependencies,
// into importable data URLs. No network, production environment or Next runtime.
const urls = new Map();
const root = new URL("../", import.meta.url);
function moduleUrl(file) {
  if (urls.has(file.href)) return urls.get(file.href);
  if (!file.href.startsWith(new URL("lib/planning/", root).href)) throw new Error("Test loader only accepts planning modules.");
  let compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  compiled = compiled.replace(/\bfrom\s+(["'])(\.[^"']+)\1/g, (_match, _quote, specifier) => {
    const dependency = new URL(specifier.endsWith(".ts") ? specifier : `${specifier}.ts`, file);
    return `from ${JSON.stringify(moduleUrl(dependency))}`;
  });
  const url = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
  urls.set(file.href, url);
  return url;
}
export function loadPlanningModule(relativePath) {
  return import(moduleUrl(new URL(relativePath, root)));
}
