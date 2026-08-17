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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
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
