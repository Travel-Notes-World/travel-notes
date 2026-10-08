import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/community/auth-forms";
import { PageHeader, PageShell } from "@/components/community/ui";

export const metadata: Metadata = { title: "Forgot your password", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return (
    <PageShell narrow>
      <PageHeader eyebrow="Community account" title="Forgot your password?" intro="Enter the email address of your account and we will send a link to choose a new password." />
      <ForgotPasswordForm />
    </PageShell>
  );
}
