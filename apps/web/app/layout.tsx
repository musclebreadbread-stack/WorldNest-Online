import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "WorldNest Online",
  description: "A browser-based 2D MMO life simulation game",
};

/**
 * Zoom is locked because the game is a fixed-viewport canvas: a double-tap that
 * pinch-zooms the page mid-gesture leaves the player looking at a magnified
 * corner of the world with no way back, and the thumb-stick would then be
 * dragging a zoomed document instead of walking.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
