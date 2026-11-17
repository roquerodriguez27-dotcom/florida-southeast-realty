import { SITE } from "@/lib/site-config";

const messages = {
  unsubscribed: {
    title: "Your saved-search alerts are turned off.",
    detail: "Email alerts for this saved search have stopped. You can create a new alert whenever you’re ready.",
    error: false,
  },
  "already-unsubscribed": {
    title: "This alert link is no longer active.",
    detail: "It may have already been used or may no longer be valid. If you still receive these alerts, use the link in the latest email or contact us.",
    error: false,
  },
  invalid: {
    title: "This unsubscribe link is invalid.",
    detail: "Use the complete unsubscribe link in your alert email, or contact us for help.",
    error: true,
  },
  "unsubscribe-error": {
    title: "We couldn’t turn off your alerts.",
    detail: "Please open the unsubscribe link in your email again. If it still doesn’t work, contact us for help.",
    error: true,
  },
} as const;

export default function SavedSearchFeedback({ status }: { status?: string | string[] }) {
  if (typeof status !== "string" || !Object.hasOwn(messages, status)) return null;
  const message = messages[status as keyof typeof messages];

  return (
    <div
      className={`mb-6 rounded-sm border p-5 ${message.error ? "border-hibiscus/25 bg-hibiscus/5" : "border-tide/20 bg-tide/5"}`}
      role={message.error ? "alert" : "status"}
    >
      <p className="font-medium text-ink">{message.title}</p>
      <p className="mt-1 text-sm text-ink/65">{message.detail}</p>
      {status !== "unsubscribed" && (
        <a className="mt-3 inline-block text-sm font-medium text-tide underline" href={`mailto:${SITE.email}`}>
          Contact Florida Southeast Realty
        </a>
      )}
    </div>
  );
}
