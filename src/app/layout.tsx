import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { Sidebar } from "@/components/dashboard/Sidebar";
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

export const dynamic = "force-dynamic";

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
      <body className="flex min-h-screen bg-surface font-sans text-content">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[760px] mx-auto px-12 pt-12 pb-24">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
