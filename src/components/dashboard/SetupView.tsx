import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { MiniLabel } from "@/components/ui/MiniLabel";
import { Btn } from "@/components/ui/Btn";

const STEPS = [
  {
    heading: "Install the Chrome extension",
    description:
      "Download the EngageAI Chrome extension and pin it to your toolbar so it's always one click away.",
  },
  {
    heading: "Link your accounts",
    description:
      "Connect your social accounts in Settings so the scraper knows which comments are yours.",
    cta: { label: "Open Settings", href: "/settings" },
  },
  {
    heading: "Open your social media tabs",
    description:
      "Open Instagram, Threads, LinkedIn, or X in Chrome. Navigate to posts with comments, or your activity/notifications page.",
  },
  {
    heading: "Click Scan",
    description:
      'Click the EngageAI extension icon and hit "Scan current tab". Comments will appear in your Inbox.',
  },
  {
    heading: "Review & reply",
    description:
      "Head to the Inbox to review AI-generated draft replies, edit them, and send.",
    cta: { label: "Open Inbox", href: "/inbox" },
  },
];

export function SetupView() {
  return (
    <div className="space-y-3 p-4">
      <MiniLabel>Getting started</MiniLabel>

      {STEPS.map((step, i) => (
        <Card key={i}>
          <div className="flex gap-3 p-4">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-sub text-[11px] font-semibold text-content-sub">
              {i + 1}
            </div>
            <div className="space-y-1">
              <p className="text-[13px] font-medium">{step.heading}</p>
              <p className="text-[13px] text-content-sub">{step.description}</p>
              {step.cta && (
                <Link href={step.cta.href} className="mt-2 inline-block">
                  <Btn variant="secondary" size="sm">
                    {step.cta.label}
                  </Btn>
                </Link>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
