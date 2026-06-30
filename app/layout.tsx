import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mantle RWA Research Agent",
  description: "AI-powered research agent for Mantle Network and Real World Assets. Live onchain data, ecosystem analysis, and distribution layer research.",
  icons: {
    icon: "/mantle-logo.png",
    shortcut: "/mantle-logo.png",
    apple: "/mantle-logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{children}</body>
    </html>
  );
}
