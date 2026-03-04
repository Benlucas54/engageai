import type { Metadata } from "next";
import { MarketingPageLayout } from "@/components/marketing/MarketingPageLayout";

export const metadata: Metadata = { title: "Cookie Policy — EngageAI" };

export default function CookiesPage() {
  return (
    <MarketingPageLayout title="Cookie Policy" lastUpdated="4 March 2025">
      <h2>1. What cookies we use</h2>
      <p>
        EngageAI uses <strong>essential cookies only</strong>. We do not use any
        analytics, advertising, or third-party tracking cookies.
      </p>
      <p>The only cookies set are:</p>
      <ul>
        <li>
          <strong>Supabase Auth session cookie</strong> — keeps you signed in
          across page loads. This cookie is strictly necessary for the Service to
          function and cannot be disabled.
        </li>
      </ul>

      <h2>2. Local storage</h2>
      <p>
        We store your cookie-consent preference in your browser&apos;s
        localStorage under the key{" "}
        <code>engageai_cookie_consent</code>. This value is never sent to our
        servers.
      </p>

      <h2>3. No tracking or advertising</h2>
      <p>
        We do not embed any third-party scripts that set cookies for tracking,
        retargeting, or advertising purposes.
      </p>

      <h2>4. Managing cookies</h2>
      <p>
        Because we only use essential cookies, there is no opt-out mechanism
        within the application — the auth cookie is required for sign-in. You
        can clear cookies at any time through your browser settings, which will
        sign you out.
      </p>
    </MarketingPageLayout>
  );
}
