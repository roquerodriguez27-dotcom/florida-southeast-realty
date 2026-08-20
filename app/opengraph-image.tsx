import { ImageResponse } from "next/og";

export const alt = "Florida Southeast Realty — South Florida Real Estate";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0e2b30",
          color: "#f7f5ee",
          padding: "72px 80px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 3, color: "#b08d4c" }}>
          FLORIDA SOUTHEAST REALTY
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 980 }}>
          <div style={{ display: "flex", fontSize: 68, lineHeight: 1.05, fontWeight: 600 }}>
            Search smarter. Research deeper. Sell for 0.5%.
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#d8ddd7" }}>
            South Florida real estate · Broward County · Palm Beach County
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 22, color: "#d8ddd7" }}>
          FloridaSoutheastRealty.com
        </div>
      </div>
    ),
    size,
  );
}
