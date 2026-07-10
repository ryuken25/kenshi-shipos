import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://kenshi-shipos.vercel.app"),
  title: {
    default: "Kenshi ShipOS — Turn a realistic plan into shipped work",
    template: "%s — Kenshi ShipOS",
  },
  description:
    "A daily execution workspace for realistic planning, focused work, blocker recovery, and automatic progress reports.",
  manifest: "/manifest.webmanifest",
  alternates: { canonical: "/" },
  icons: {
    icon: "/brand/verse/verse-logo.png",
    apple: "/brand/verse/verse-logo.png",
  },
  openGraph: {
    type: "website",
    url: "https://kenshi-shipos.vercel.app",
    title: "Kenshi ShipOS",
    description:
      "Plan what fits, focus on one task, recover when blocked, and show what you shipped.",
    siteName: "Kenshi ShipOS",
    images: ["/brand/verse/verse-logo.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kenshi ShipOS",
    description:
      "Plan what fits, focus on one task, recover when blocked, and show what you shipped.",
  },
  other: { "theme-color": "#0a0e27" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <script
          defer
          data-domain="kenshi-shipos.vercel.app"
          src="https://analytics.vgdh.io/js/script.js"
        ></script>
      </head>
      <body className="min-h-screen bg-[var(--color-base)] text-[var(--color-text)] antialiased">
        {children}
      </body>
    </html>
  );
}
