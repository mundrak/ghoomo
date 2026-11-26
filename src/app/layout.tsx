import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
// Self-hosted fonts, so builds don't depend on reaching Google Fonts.
import "@fontsource-variable/instrument-sans/index.css";
import "@fontsource/space-mono/400.css";
// Local-script place names. Each file covers one script and only downloads when that script is on screen.
import "@fontsource/noto-sans-devanagari/600.css";
import "@fontsource/noto-sans-kannada/600.css";
import "@fontsource/noto-sans-tamil/600.css";
import "@fontsource/noto-sans-malayalam/600.css";
import "@fontsource/noto-sans-thai/600.css";
import "@fontsource/noto-sans-arabic/600.css";
import "@fontsource/noto-sans-sinhala/600.css";
import "@fontsource/noto-sans-georgian/600.css";
import "@fontsource/noto-sans-bengali/600.css";
import "@fontsource/noto-sans-oriya/600.css";
import "@fontsource/noto-sans-gurmukhi/600.css";
import "@fontsource/noto-sans-balinese/600.css";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "ghoomo: trips planned around your budget",
  description: "Tell us who's going and what each of you can spend. See where you can go, and plan every day of it. A side project by khushi.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // The theme script sets data-theme before React loads, so the attribute differs from the server's HTML.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply a saved light/dark choice before first paint, so the page doesn't flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {children}
        {/* Page views, once Web Analytics is turned on in the Vercel project. Cookie-free. */}
        <Analytics />
        {/* Real-visitor page speed, once Speed Insights is turned on in the Vercel project. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
