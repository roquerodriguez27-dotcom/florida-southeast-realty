import { cache } from 'react';
import { cached } from '../../lib/data';
export const dynamic = 'force-dynamic';
const readShared = cache(() => cached('shared'));
export async function generateMetadata() {
  await readShared();
  return { title: 'Synthetic lifecycle test' };
}
export default async function Page({ params }) {
  const { mode } = await params;
  const result = mode === 'duplicate'
    ? await Promise.all([readShared(), readShared(), cached('shared')]).then(values => values[0])
    : await readShared();
  globalThis.__fsrLifecycleEmit?.('page_ready');
  return <h1>{result}</h1>;
}
