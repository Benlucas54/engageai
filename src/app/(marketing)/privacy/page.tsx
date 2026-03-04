import type { Metadata } from "next";
import { MarketingPageLayout } from "@/components/marketing/MarketingPageLayout";

export const metadata: Metadata = { title: "Privacy Policy — EngageAI" };

export default function PrivacyPage() {
  return (
    <MarketingPageLayout title="Privacy Policy" lastUpdated="4 March 2025">
      <h2>1. What we collect</h2>
      <p>
        When you use EngageAI we collect and process the following categories of
        personal data:
      </p>
      <ul>
        <li>
          <strong>Account information</strong> — email address, display name,
          and hashed password stored via Supabase Auth.
        </li>
        <li>
          <strong>Linked social-media accounts</strong> — platform usernames you
          connect (Instagram, Threads, X, LinkedIn, TikTok, YouTube).
        </li>
        <li>
          <strong>Comments and replies</strong> — public comments collected from
          your linked accounts and AI-generated reply drafts.
        </li>
        <li>
          <strong>Commenter profiles</strong> — aggregated, non-identifying
          summaries of repeat commenters (username, topics, comment count).
        </li>
        <li>
          <strong>Voice documents</strong> — PDFs or text files you upload to
          train your brand voice.
        </li>
        <li>
          <strong>Voice settings and examples</strong> — tone, phrases, and
          example replies you configure.
        </li>
      </ul>

      <h2>2. How we use your data</h2>
      <p>We use the data above to:</p>
      <ul>
        <li>Generate on-brand reply drafts using the Anthropic Claude API.</li>
        <li>Build commenter profiles so you can see engagement patterns.</li>
        <li>Run automation rules you configure.</li>
        <li>Authenticate you and keep you signed in.</li>
      </ul>

      <h2>3. Third-party processors</h2>
      <p>Your data is processed by the following sub-processors:</p>
      <ul>
        <li>
          <strong>Anthropic</strong> — comment text and voice settings are sent
          to the Claude API to generate replies. Anthropic does not use API
          inputs for training.
        </li>
        <li>
          <strong>Supabase</strong> — database hosting, authentication, and file
          storage. Data is stored in a Supabase-managed PostgreSQL instance.
        </li>
        <li>
          <strong>Vercel</strong> — application hosting and serverless function
          execution.
        </li>
      </ul>

      <h2>4. Data retention</h2>
      <p>
        We retain your data for as long as your account is active. When you
        delete your account, all associated data is permanently removed within
        30 days, including voice documents stored in our file storage bucket.
      </p>

      <h2>5. Your rights</h2>
      <p>You may exercise the following rights at any time from Settings:</p>
      <ul>
        <li>
          <strong>Access &amp; portability</strong> — download a full export of
          your data in JSON format.
        </li>
        <li>
          <strong>Erasure</strong> — permanently delete your account and all
          associated data.
        </li>
        <li>
          <strong>Rectification</strong> — update your account information in
          Settings.
        </li>
      </ul>

      <h2>6. Cookies</h2>
      <p>
        We use only essential cookies required for authentication. See our{" "}
        <a href="/cookies">Cookie Policy</a> for details.
      </p>

      <h2>7. Contact</h2>
      <p>
        For privacy-related enquiries, email{" "}
        <strong>privacy@promptpreneur.com</strong>.
      </p>
    </MarketingPageLayout>
  );
}
