import type { Metadata } from "next";
import { MarketingPageLayout } from "@/components/marketing/MarketingPageLayout";

export const metadata: Metadata = { title: "Terms of Service — EngageAI" };

export default function TermsPage() {
  return (
    <MarketingPageLayout title="Terms of Service" lastUpdated="4 March 2025">
      <h2>1. Service description</h2>
      <p>
        EngageAI (&quot;the Service&quot;) is a browser-based tool operated by
        Promptpreneur that collects public social-media comments, generates
        AI-powered reply drafts, and optionally posts them on your behalf.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least 18 years old and have the authority to bind yourself
        or your organisation to these terms.
      </p>

      <h2>3. Your obligations</h2>
      <ul>
        <li>Maintain the security of your account credentials.</li>
        <li>
          Comply with the terms of service of every social-media platform you
          connect.
        </li>
        <li>
          Review AI-generated replies before they are posted, unless you have
          explicitly enabled full automation.
        </li>
        <li>
          Abide by our <a href="/acceptable-use">Acceptable Use Policy</a>.
        </li>
      </ul>

      <h2>4. Intellectual property</h2>
      <p>
        You retain ownership of the content you upload (voice documents,
        examples). AI-generated reply drafts are provided for your use and you
        may use them freely once posted to a social-media platform. EngageAI
        retains no ownership of published replies.
      </p>

      <h2>5. Account termination</h2>
      <p>
        You may delete your account at any time from Settings. We may suspend or
        terminate accounts that violate these terms or the Acceptable Use
        Policy, with notice where practicable.
      </p>

      <h2>6. Limitation of liability</h2>
      <p>
        The Service is provided &quot;as is&quot;. To the maximum extent
        permitted by law, Promptpreneur is not liable for any indirect,
        incidental, or consequential damages arising from your use of the
        Service, including but not limited to account suspensions on third-party
        platforms resulting from posted replies.
      </p>

      <h2>7. Changes to these terms</h2>
      <p>
        We may update these terms from time to time. Material changes will be
        communicated via the email address on your account at least 14 days
        before they take effect.
      </p>

      <h2>8. Governing law</h2>
      <p>
        These terms are governed by the laws of England and Wales. Any disputes
        will be subject to the exclusive jurisdiction of the courts of England
        and Wales.
      </p>
    </MarketingPageLayout>
  );
}
