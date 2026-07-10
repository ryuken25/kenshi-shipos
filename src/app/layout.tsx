import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kenshi ShipOS",
  manifest: "/manifest.webmanifest",
  description: "A daily command center for focus sprints, AI-agent tasks, blockers, prompts, decisions, and ship logs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0B0D14] text-[#F6F7FB] antialiased">
        {children}
      </body>
    </html>
  );
}
