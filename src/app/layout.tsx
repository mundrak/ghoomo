import type { Metadata } from "next";
import { Archivo_Black, Caveat, Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });
const archivoBlack = Archivo_Black({ subsets: ["latin"], weight: "400", variable: "--font-archivo-black" });
const caveat = Caveat({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-caveat" });

export const metadata: Metadata = {
  title: "ghoomo · trips planned around your budget",
  description: "Tell us your budget. We'll show you where you can go and plan every day of it. A side project by khushi.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${archivoBlack.variable} ${caveat.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
