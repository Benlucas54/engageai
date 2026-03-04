import Link from "next/link";

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/cookies", label: "Cookies" },
  { href: "/acceptable-use", label: "Acceptable Use" },
];

export function MarketingPageLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-surface/80 backdrop-blur border-b border-border">
        <div className="max-w-[1080px] mx-auto px-6 lg:px-12 flex items-center justify-between h-14">
          <Link href="/">
            <span className="text-[15px] font-semibold tracking-[-0.03em] text-content">
              EngageAI
            </span>
            <span className="text-[11px] text-content-xfaint ml-2">
              by Promptpreneur
            </span>
          </Link>
          <Link
            href="/login"
            className="text-[11px] text-content-sub hover:text-content transition-colors"
          >
            Sign in
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 max-w-[720px] mx-auto w-full px-6 lg:px-12 pt-16 pb-20">
        <h1 className="font-display text-[clamp(1.5rem,3.5vw,2.25rem)] leading-[1.15] tracking-[-0.03em] text-content">
          {title}
        </h1>
        <p className="text-[11px] text-content-faint mt-2 mb-10">
          Last updated: {lastUpdated}
        </p>
        <div className="prose-legal">{children}</div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border-light">
        <div className="max-w-[720px] mx-auto px-6 lg:px-12 py-10 text-center">
          <div className="flex justify-center gap-4 flex-wrap">
            {LEGAL_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-[11px] text-content-faint hover:text-content transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
          <p className="text-[11px] text-content-xfaint mt-4">
            &copy; {new Date().getFullYear()} Promptpreneur
          </p>
        </div>
      </footer>
    </div>
  );
}
