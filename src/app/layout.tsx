import type { Metadata, Viewport } from "next";
import { Caveat, Space_Grotesk } from "next/font/google";
import "./globals.css";

const ui = Space_Grotesk({ subsets: ["latin"], variable: "--font-ui" });
const hand = Caveat({ subsets: ["latin"], variable: "--font-hand", weight: ["500", "700"] });

export const metadata: Metadata = {
  title: "Back Bencher: Exam Cheating Simulator",
  description: "A top-down comedy stealth game. Phone under the desk, eyes on the teacher.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d1117",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${hand.variable}`}>
      <body>{children}</body>
    </html>
  );
}
