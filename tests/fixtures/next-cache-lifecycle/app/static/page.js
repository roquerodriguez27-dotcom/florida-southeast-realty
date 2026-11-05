import { cached } from '../../lib/data';
export const revalidate = 60;
export default async function Page() {
  return <h1>{await cached('static')}</h1>;
}
