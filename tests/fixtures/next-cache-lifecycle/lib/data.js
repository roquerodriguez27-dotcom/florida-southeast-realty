import { unstable_cache } from 'next/cache';
export const cached = unstable_cache(async () => {
  globalThis.__fsrLifecycleEmit?.('refresh_start');
  await new Promise(resolve => setTimeout(resolve, globalThis.__fsrLifecycleConfig?.refreshDelay ?? 5));
  globalThis.__fsrLifecycleEmit?.('refresh_end');
  return 'fresh-value';
}, ['synthetic-lifecycle-test'], { revalidate: 1 });
