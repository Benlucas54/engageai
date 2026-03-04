import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { CookieConsent } from "@/components/CookieConsent";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["300", "400", "500", "600"],
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "EngageAI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${dmSans.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-surface font-sans text-content">
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
