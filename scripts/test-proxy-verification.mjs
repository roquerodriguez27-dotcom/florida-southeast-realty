import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
globalThis.AsyncLocalStorage ??= AsyncLocalStorage;
const { NextRequest, NextResponse } = require("next/server");
const { unstable_doesMiddlewareMatch } = require("next/experimental/testing/server");
const verifier = "Mozilla/5.0 (compatible; Google-Site-Verification/1.0)";
const browser = "Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36";
const sessionRequests = [];
const compiledModule = { exports: {} };
const compiled = ts.transpileModule(fs.readFileSync(new URL("../proxy.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const isolatedRequire = (specifier) => {
  if (specifier === "next/server") return { NextResponse };
  if (specifier === "@/lib/supabase/proxy") return {
    updateSession: async (request) => {
      sessionRequests.push(request.nextUrl.pathname);
      return new NextResponse(null, { status: 401 });
    },
  };
  throw new Error(`Unexpected dependency: ${specifier}`);
};
vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, {}, { filename: "proxy.ts" })(
  isolatedRequire, compiledModule, compiledModule.exports,
);
const { proxy, config } = compiledModule.exports;
const run = (pathname = "/", userAgent = verifier, accept = "*/*", method = "GET") => proxy(
  new NextRequest(`https://www.floridasoutheastrealty.com${pathname}`, {
    method, headers: { "user-agent": userAgent, accept },
  }),
);

// The documented ownership fetch must reach the homepage's server-rendered tag.
const verification = await run();
assert.equal(verification.status, 200);
assert.equal(verification.headers.get("x-middleware-next"), "1");
assert.equal(verification.headers.get("x-robots-tag"), null);

// The exception must not become a general crawler or browser-header bypass.
for (const [pathname, userAgent] of [
  ["/about", verifier],
  ["/properties", verifier],
  ["/homes-for-sale/boca-raton", verifier],
  ["/", browser],
  ["/", "curl/8.0"],
  ["/", `${verifier} extra`],
]) {
  const rejected = await run(pathname, userAgent);
  assert.equal(rejected.status, 204, `${userAgent} ${pathname}`);
  assert.equal(rejected.headers.get("cache-control"), "private, no-store");
}
const navigation = await run("/", browser, "text/html");
assert.equal(navigation.headers.get("x-middleware-next"), "1");
const mlsChallenge = await run("/properties", verifier, "text/html");
assert.equal(mlsChallenge.headers.get("x-middleware-next"), null);
assert.equal(mlsChallenge.headers.get("x-robots-tag"), "noindex, nofollow");
assert.match(await mlsChallenge.text(), /Checking your browser/);

// Non-GET requests keep the existing behavior for an ordinary browser UA.
for (const method of ["HEAD", "POST"]) {
  for (const pathname of ["/", "/properties"]) {
    const actual = await run(pathname, verifier, "*/*", method);
    const ordinary = await run(pathname, browser, "*/*", method);
    assert.equal(actual.status, ordinary.status);
    assert.deepEqual([...actual.headers], [...ordinary.headers]);
  }
}

// CRM still reaches session processing; API requests remain outside this proxy.
assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: "/crm/leads" }), true);
assert.equal((await run("/crm/leads")).status, 401);
assert.deepEqual(sessionRequests, ["/crm/leads"]);
for (const pathname of ["/api/analytics", "/api/inquiries"]) {
  assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: pathname }), false);
}

console.log("Homepage verification and existing proxy protections passed; no network requests were made.");
