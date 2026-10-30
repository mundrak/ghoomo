import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ghoomo · budget-first trip planner",
  description: "Tell us your budget. We'll tell you where to go and plan the whole trip.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
