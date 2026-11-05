import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');
const fixture = fs.mkdtempSync(path.join(root, '.cache-lifecycle-test-'));
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1' };
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: fixture, env, stdio: 'inherit', timeout: 180_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Lifecycle integration failed with exit ${result.status}.`);
}
try {
  fs.cpSync(path.join(root, 'tests/fixtures/next-cache-lifecycle'), fixture, { recursive: true });
  fs.writeFileSync(path.join(fixture, 'package.json'), JSON.stringify({ name: 'synthetic-cache-lifecycle', private: true }));
  fs.writeFileSync(path.join(fixture, 'next.config.js'), `module.exports = { cacheHandler: require.resolve('./cache-handler.cjs'), cacheMaxMemorySize: 0, experimental: { cpus: 1 }, turbopack: { root: ${JSON.stringify(root)} } };`);
  for (const bundler of ['webpack', 'turbopack']) {
    console.log(`Verifying cache lifecycle with ${bundler}.`);
    fs.rmSync(path.join(fixture, '.next'), { recursive: true, force: true });
    run([nextBin, 'build', ...(bundler === 'webpack' ? ['--webpack'] : [])]);
    const staticHtml = fs.readFileSync(path.join(fixture, '.next/server/app/static.html'), 'utf8');
    if (!staticHtml.includes('fresh-value')) throw new Error('Static generation did not await refreshed data.');
    run([path.join(fixture, 'run.mjs')]);
  }
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
