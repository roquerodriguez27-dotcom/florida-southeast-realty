import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/search-results", destination: "/properties", permanent: true },
      { source: "/agents", destination: "/about", permanent: true },
      { source: "/info/1", destination: "/referral-status", permanent: true },
      { source: "/terms-services", destination: "/terms-of-use", permanent: true },
      { source: "/terms-and-services", destination: "/terms-of-use", permanent: true },
      { source: "/dmca-notice", destination: "/terms-of-use", permanent: true },
    ];
  },
};

export default nextConfig;
