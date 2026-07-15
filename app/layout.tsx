import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

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

const SITE_URL = "https://www.floridasoutheastrealty.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  title: {
    default: "Florida Southeast Realty | 0.5% Listing Fee, South Florida Real Estate",
    template: "%s | Florida Southeast Realty",
  },
  description:
    "Independent South Florida brokerage serving Fort Lauderdale, Boca Raton, Delray Beach, Boynton Beach, Lake Worth, West Palm Beach, Wellington, Palm Beach Gardens, and Jupiter. List your home for a 0.5% listing-side fee.",
  keywords: [
    "South Florida real estate",
    "0.5% listing fee Florida",
    "Fort Lauderdale waterfront homes",
    "Boca Raton luxury real estate",
    "West Palm Beach real estate agent",
    "Delray Beach homes for sale",
    "Palm Beach Gardens real estate",
    "Wellington FL homes for sale",
  ],
  openGraph: {
    type: "website",
    siteName: "Florida Southeast Realty",
    title: "Florida Southeast Realty | Waterfront & Luxury Homes",
    description:
      "Waterfront and luxury listings, community guides, and local market expertise across Southeast Florida's Intracoastal corridor.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Florida Southeast Realty",
    description: "Waterfront and luxury homes from Fort Lauderdale to Boca Raton.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: "Florida Southeast Realty, Inc.",
    url: SITE_URL,
    telephone: "+1-954-555-0100",
    areaServed: [
      "Fort Lauderdale, FL",
      "Boca Raton, FL",
      "Wilton Manors, FL",
      "Hillsboro Beach, FL",
      "Delray Beach, FL",
      "Boynton Beach, FL",
      "Lake Worth, FL",
      "West Palm Beach, FL",
      "Wellington, FL",
      "Palm Beach Gardens, FL",
      "Jupiter, FL",
    ],
    address: {
      "@type": "PostalAddress",
      streetAddress: "215 Las Olas Blvd, Suite 400",
      addressLocality: "Fort Lauderdale",
      addressRegion: "FL",
      postalCode: "33301",
      addressCountry: "US",
    },
  };

  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:bg-sand focus:text-tide focus:px-4 focus:py-2 focus:rounded-sm"
        >
          Skip to main content
        </a>
        <Header />
        <main id="main-content">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
