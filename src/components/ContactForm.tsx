"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormMessage, SubmitButton } from "@/components/community/client";
import { describedBy, Field, inputClass } from "@/components/community/ui";
import { contactAction } from "@/lib/contact-action";
import type { ActionState } from "@/lib/community/next/forms";
import { initialState } from "@/lib/community/next/state";

const TOPICS: [string, string][] = [
  ["general", "General question"],
  ["correction", "Correction to an article"],
  ["advertising", "Advertising or partnership"],
  ["pitch", "Guest article pitch"],
  ["privacy", "Privacy or my data"],
  ["other", "Something else"],
];

const val = (state: ActionState, key: string, fallback = "") => (!state.ok && typeof state.values?.[key] === "string" ? (state.values[key] as string) : fallback);

export function ContactForm({ defaultTopic = "", defaultPageUrl = "" }: { defaultTopic?: string; defaultPageUrl?: string }) {
  const [state, action] = useActionState(contactAction, initialState);
  const f = state.fields ?? {};
  return (
    // Re-keyed after success so the fields start empty again.
    <form key={state.ok ? "sent" : "form"} action={action} noValidate className="max-w-[640px]">
      <FormMessage state={state} successTitle="Message sent" />
      <Field id="name" label="Your name" error={f.name} required>
        <input {...describedBy("name", null, f.name)} name="name" maxLength={100} required autoComplete="name" defaultValue={val(state, "name")} className={inputClass} />
      </Field>
      <Field id="email" label="Your email address" hint="We only use it to reply to you." error={f.email} required>
        <input {...describedBy("email", true, f.email)} name="email" type="email" maxLength={254} required autoComplete="email" inputMode="email" defaultValue={val(state, "email")} className={inputClass} />
      </Field>
      <Field id="topic" label="What is it about?" error={f.topic} required>
        <select {...describedBy("topic", null, f.topic)} name="topic" required defaultValue={val(state, "topic", defaultTopic)} className={inputClass}>
          <option value="" disabled>Choose one</option>
          {TOPICS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </Field>
      <Field id="subject" label="Subject" error={f.subject} required>
        <input {...describedBy("subject", null, f.subject)} name="subject" maxLength={150} required defaultValue={val(state, "subject")} className={inputClass} />
      </Field>
      <Field id="pageUrl" label="Link to the page it is about" hint="For a correction, paste the address of the article." error={f.pageUrl} optional>
        <input {...describedBy("pageUrl", true, f.pageUrl)} name="pageUrl" type="url" maxLength={500} inputMode="url" placeholder="https://travelnotesworld.com/…" defaultValue={val(state, "pageUrl", defaultPageUrl)} className={inputClass} />
      </Field>
      <Field id="message" label="Your message" hint="Between 20 and 5,000 characters." error={f.message} required>
        <textarea {...describedBy("message", true, f.message)} name="message" rows={8} maxLength={5000} required defaultValue={val(state, "message")} className={inputClass} />
      </Field>
      {/* A field people never see or fill in. Scripts that fill every field give themselves away. */}
      <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden">
        <label htmlFor="website">Leave this empty</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <p className="t-body-sm text-ink-600 mt-5 mb-0">
        We keep your message so we can answer it and follow up. Read how we handle personal information in our <Link href="/privacy" className="text-marine-600">privacy notice</Link>.
      </p>
      <div className="mt-6"><SubmitButton pendingText="Sending…">Send message</SubmitButton></div>
    </form>
  );
}
