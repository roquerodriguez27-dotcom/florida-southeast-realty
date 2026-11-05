import { Suspense } from 'react';
import Analytics from './analytics';
export default function Layout({ children }) {
  return <html><body>{children}<Suspense fallback={null}><Analytics /></Suspense></body></html>;
}
