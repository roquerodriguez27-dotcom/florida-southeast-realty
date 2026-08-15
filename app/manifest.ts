import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Florida Southeast Realty",
    short_name: "FSR",
    description: "South Florida home search, neighborhood research, and seller representation.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f5ee",
    theme_color: "#0e2b30",
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
  };
}
