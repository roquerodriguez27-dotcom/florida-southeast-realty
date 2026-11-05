import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { applyPatch, originalSource, prepareBuild, verifyBuild } from '../scripts/next-cache-lifecycle.mjs';

const require = createRequire(import.meta.url);
const nextRoot = path.dirname(require.resolve('next/package.json'));
const files = [
  ['dist/server/web/spec-extension/unstable-cache.js', '_workasyncstorageexternal.workAsyncStorage'],
  ['dist/esm/server/web/spec-extension/unstable-cache.js', 'workAsyncStorage'],
];
const originals = files.map(([file, storage]) => originalSource(fs.readFileSync(path.join(nextRoot, file), 'utf8'), storage));
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fsr-cache-patch-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '16.2.10' }));
  files.forEach(([file], i) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), originals[i]);
  });
  return root;
}
const contents = root => files.map(([file]) => fs.readFileSync(path.join(root, file), 'utf8'));

test('pristine install patches both module formats, repeats safely, and restores exact original bytes', t => {
  const root = fixture(t);
  assert.equal(applyPatch(root), true);
  const patched = contents(root);
  assert.ok(patched.every(code => code.includes('function retainFsrCacheWork')));
  assert.equal(applyPatch(root), false);
  assert.deepEqual(contents(root), patched);
  assert.equal(applyPatch(root, { restore: true }), true);
  assert.deepEqual(contents(root), originals);
  assert.equal(applyPatch(root, { restore: true }), false);
});

test('unknown framework version fails before changing either source', t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '16.4.5' }));
  assert.throws(() => applyPatch(root), /reviewed Next/);
  assert.deepEqual(contents(root), originals);
});

test('modified second source fails before writing the valid first source', t => {
  const root = fixture(t);
  fs.appendFileSync(path.join(root, files[1][0]), '\n// unexpected modification');
  const before = contents(root);
  assert.throws(() => applyPatch(root), /hash mismatch/);
  assert.deepEqual(contents(root), before);
});

test('modified patch fails closed for both install and rollback', t => {
  const root = fixture(t);
  applyPatch(root);
  const filename = path.join(root, files[0][0]);
  fs.writeFileSync(filename, fs.readFileSync(filename, 'utf8').replace('pending.catch(()=>undefined)', 'pending.catch(()=>"unexpected")'));
  const before = contents(root);
  assert.throws(() => applyPatch(root), /hash mismatch/);
  assert.throws(() => applyPatch(root, { restore: true }), /hash mismatch/);
  assert.deepEqual(contents(root), before);
});

test('interrupted two-file install can safely complete only known source states', t => {
  const root = fixture(t);
  applyPatch(root);
  fs.writeFileSync(path.join(root, files[1][0]), originals[1]);
  assert.equal(applyPatch(root), true);
  assert.equal(applyPatch(root), false);
});

test('compiler invalidation preserves warm fetch data and unrelated files', t => {
  const root = fixture(t);
  for (const name of ['webpack/server-production/cache.pack', 'fetch-cache/warm-listing', 'swc/plugins/state', 'unrelated']) {
    const file = path.join(root, '.next/cache', name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'preserve');
  }
  prepareBuild(root);
  assert.equal(fs.existsSync(path.join(root, '.next/cache/webpack')), false);
  for (const name of ['fetch-cache/warm-listing', 'swc/plugins/state', 'unrelated']) {
    assert.equal(fs.readFileSync(path.join(root, '.next/cache', name), 'utf8'), 'preserve');
  }
});

test('build verification rejects unpatched output', t => {
  const root = fixture(t);
  const chunks = path.join(root, '.next/server/chunks');
  fs.mkdirSync(chunks, { recursive: true });
  fs.writeFileSync(path.join(chunks, 'baseline.js'), originals[0]);
  assert.throws(() => verifyBuild(root), /unverified build/);
});
