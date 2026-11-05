module.exports = class {
  async get(_key, context) {
    if (context.kind !== 'FETCH') return null;
    const config = globalThis.__fsrLifecycleConfig ?? {};
    globalThis.__fsrLifecycleEmit?.('cache_read_start');
    if (config.readDelay) await new Promise(resolve => setTimeout(resolve, config.readDelay));
    globalThis.__fsrLifecycleEmit?.('cache_read_done');
    if (config.state === 'miss') return null;
    return {
      lastModified: Date.now() - (config.state === 'fresh' ? 0 : 600_000),
      value: { kind: 'FETCH', data: { headers: {}, body: JSON.stringify('stale-value'), status: 200, url: '' }, revalidate: 1 },
    };
  }
  async set() {
    globalThis.__fsrLifecycleEmit?.('cache_write_start');
    const delay = globalThis.__fsrLifecycleConfig?.writeDelay;
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    globalThis.__fsrLifecycleEmit?.('cache_write_end');
  }
  async revalidateTag() {}
  resetRequestCache() {}
};
