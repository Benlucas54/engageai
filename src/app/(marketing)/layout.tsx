import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EngageAI — AI-Powered Social Media Engagement",
  description:
    "Never miss a comment again. EngageAI reads your comments, generates on-brand replies, and posts them automatically across Instagram, Threads, X, LinkedIn, and more.",
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
