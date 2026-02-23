import { Bird, ArrowLeft } from 'lucide-react';

export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Bird className="size-4 text-primary" />
            <span className="font-semibold tracking-tight">Lyrebird</span>
          </div>
          <a
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to sign in
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: February 21, 2026
          </p>
        </div>

        <div className="space-y-8 text-[0.9375rem] leading-relaxed">
          <section>
            <p className="text-muted-foreground">
              This Privacy Policy describes how Lyrebird collects, uses, and
              handles information when you use our sentiment analysis dashboard.
              We keep it simple: we collect only what is necessary to operate
              the service.
            </p>
          </section>

          <Section title="1. Information We Collect">
            <Subsection label="Authentication data">
              When you sign in with Google, we receive your name, email address,
              and profile picture from Google&apos;s OAuth service. This is used
              solely to identify your account and is not shared with third
              parties.
            </Subsection>
            <Subsection label="Session data">
              We store a session token in your browser to keep you authenticated
              between visits. This token is invalidated when you sign out.
            </Subsection>
            <Subsection label="Usage data">
              We may log basic usage events (e.g., which analyses you run,
              timestamps) to monitor system health and improve the service.
              These logs do not contain the content of Bluesky posts.
            </Subsection>
          </Section>

          <Section title="2. Information We Do Not Collect">
            <p>Lyrebird does not:</p>
            <ul className="ml-4 list-disc space-y-1.5 text-muted-foreground">
              <li>Store the text of individual Bluesky posts</li>
              <li>Build profiles of Bluesky users</li>
              <li>Sell or share your personal information with advertisers</li>
              <li>Track your activity across other websites or services</li>
            </ul>
          </Section>

          <Section title="3. Third-Party Services">
            <Subsection label="Google OAuth">
              Authentication is handled by Google. When you sign in, you
              interact with Google&apos;s authentication service, which is
              subject to{' '}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-foreground transition-colors"
              >
                Google&apos;s Privacy Policy
              </a>
              .
            </Subsection>
            <Subsection label="Bluesky / AT Protocol">
              Lyrebird connects to the Bluesky public firehose to ingest posts
              for analysis. Only public posts are processed; no private account
              data is accessed. This data is governed by{' '}
              <a
                href="https://bsky.social/about/support/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-foreground transition-colors"
              >
                Bluesky&apos;s Privacy Policy
              </a>
              .
            </Subsection>
          </Section>

          <Section title="4. How We Use Your Information">
            <p>We use the information we collect to:</p>
            <ul className="ml-4 list-disc space-y-1.5 text-muted-foreground">
              <li>Authenticate and maintain your session</li>
              <li>Display your name and avatar in the dashboard</li>
              <li>Monitor and improve service performance and stability</li>
            </ul>
            <p>
              We do not use your data for advertising, profiling, or any purpose
              beyond operating the service.
            </p>
          </Section>

          <Section title="5. Data Retention">
            <p>
              Session data is retained for the duration of your session and
              deleted upon sign-out. Authentication profile data (name, email,
              avatar) is retained for as long as you have an active account.
            </p>
            <p>
              Usage logs are retained for a limited period for operational
              purposes and then deleted.
            </p>
          </Section>

          <Section title="6. Your Rights">
            <p>You have the right to:</p>
            <ul className="ml-4 list-disc space-y-1.5 text-muted-foreground">
              <li>
                <strong className="text-foreground font-medium">Access</strong>{' '}
                — request a copy of the personal data we hold about you
              </li>
              <li>
                <strong className="text-foreground font-medium">
                  Deletion
                </strong>{' '}
                — request deletion of your account and associated data
              </li>
              <li>
                <strong className="text-foreground font-medium">
                  Correction
                </strong>{' '}
                — request correction of inaccurate data
              </li>
            </ul>
            <p>
              To exercise these rights, contact the project maintainers via the
              repository or contact information listed in the project
              documentation.
            </p>
          </Section>

          <Section title="7. Security">
            <p>
              We take reasonable measures to protect the information we hold.
              Authentication uses industry-standard OAuth 2.0, and sessions are
              managed with secure, httpOnly cookies. No system is completely
              secure, however, and we cannot guarantee the absolute security of
              your information.
            </p>
          </Section>

          <Section title="8. Changes to This Policy">
            <p>
              We may update this policy from time to time. When we do, we will
              update the date at the top of this page. Continued use of the
              service after changes are posted constitutes acceptance of the
              updated policy.
            </p>
          </Section>

          <Section title="9. Contact">
            <p>
              Questions or concerns about this Privacy Policy can be directed to
              the project maintainers via the repository or contact information
              in the project documentation.
            </p>
          </Section>
        </div>
      </main>

      <footer className="border-t py-8">
        <p className="text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Lyrebird &mdash;{' '}
          <a
            href="/terms"
            className="underline underline-offset-4 hover:text-foreground transition-colors"
          >
            Terms of Service
          </a>
        </p>
      </footer>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}

function Subsection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <p>
      <strong className="font-medium text-foreground">{label}:</strong>{' '}
      {children}
    </p>
  );
}
