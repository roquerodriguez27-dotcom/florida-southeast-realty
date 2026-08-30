import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Suspense } from "react";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SITE } from "@/lib/site-config";
import { serializeJsonLd } from "@/lib/seo/json-ld";
import CompareTray from "@/components/CompareTray";
import SiteAnalytics from "@/components/SiteAnalytics";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "500"],
  display: "swap",
});

const analyticsId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0e2b30",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "Florida Southeast Realty | South Florida Homes & 0.5% Listing Fee",
    template: "%s | Florida Southeast Realty",
  },
  description:
    "Search South Florida real estate, research neighborhoods, and sell with Florida Southeast Realty's 0.5% listing-side fee. Serving Palm Beach and Broward County communities.",
  applicationName: SITE.shortName,
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: SITE.shortName,
    title: "Florida Southeast Realty | Search, Research, Buy & Sell in South Florida",
    description:
      "South Florida homes, neighborhood research, buyer due diligence, and full-service seller representation with a 0.5% listing-side fee.",
    url: SITE.url,
    locale: "en_US",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Florida Southeast Realty" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Florida Southeast Realty",
    description: "Search South Florida homes, research neighborhoods, and sell for a 0.5% listing-side fee.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: googleSiteVerification ? { google: googleSiteVerification } : undefined,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const agentId = `${SITE.url}/#real-estate-agent`;
  const brokerId = `${SITE.url}/#broker`;
  const websiteId = `${SITE.url}/#website`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["RealEstateAgent", "LocalBusiness"],
        "@id": agentId,
        name: SITE.name,
        url: SITE.url,
        telephone: SITE.phoneDisplay,
        email: SITE.email,
        address: {
          "@type": "PostalAddress",
          streetAddress: SITE.address.street,
          addressLocality: SITE.address.city,
          addressRegion: SITE.address.region,
          postalCode: SITE.address.postalCode,
          addressCountry: SITE.address.country,
        },
        areaServed: SITE.serviceAreas.map((name) => ({ "@type": "Place", name: `${name}, Florida` })),
        founder: { "@id": brokerId },
        priceRange: "0.5% listing-side fee; commissions negotiable",
      },
      {
        "@type": "Person",
        "@id": brokerId,
        name: SITE.brokerName,
        jobTitle: "Broker",
        image: `${SITE.url}${SITE.brokerImage}`,
        worksFor: { "@id": agentId },
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: SITE.shortName,
        url: SITE.url,
        publisher: { "@id": agentId },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE.url}/properties?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body className="antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
        {analyticsId && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${analyticsId}`} strategy="afterInteractive" />
            <Script id="google-analytics" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${analyticsId}', { anonymize_ip: true });`}
            </Script>
          </>
        )}
        <Suspense fallback={null}><SiteAnalytics /></Suspense>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:bg-sand focus:text-tide focus:px-4 focus:py-2 focus:rounded-sm"
        >
          Skip to main content
        </a>
        <Header />
        <main id="main-content">{children}</main>
        <CompareTray />
        <Footer />
      </body>
    </html>
  );
}
