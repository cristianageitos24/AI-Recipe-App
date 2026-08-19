import { ImageResponse } from "next/og";

export const alt = "HomeRecipe — simple and tasty recipes";
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
          justifyContent: "center",
          padding: 80,
          background: "#f7f9f7",
        }}
      >
        <div
          style={{
            width: 64,
            height: 8,
            background: "#dc2100",
            marginBottom: 36,
          }}
        />
        <div
          style={{
            fontSize: 80,
            fontWeight: 800,
            color: "#171717",
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
          }}
        >
          HomeRecipe
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 34,
            color: "#4a4a4a",
            maxWidth: 900,
            lineHeight: 1.35,
          }}
        >
          Simple and tasty recipes. Search, save, and plan your meals.
        </div>
      </div>
    ),
    { ...size },
  );
}
