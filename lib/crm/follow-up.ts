export const FOLLOW_UP_STATES = [
  "queued", "drafting", "review", "draft_failed", "sending", "accepted",
  "send_failed", "delivery_unknown", "paused", "stopped",
] as const;

export type FollowUpState = (typeof FOLLOW_UP_STATES)[number];

export interface CrmFollowUp {
  id: string;
  lead_id: number;
  recipient_email: string;
  state: FollowUpState;
  test_mode: boolean;
  source_snapshot: {
    full_name?: string;
    form_name?: string;
    property_interest?: string;
    message?: string;
    fields?: Record<string, unknown>;
  };
  draft_subject: string | null;
  draft_body: string | null;
  draft_mode: "ai" | "template" | "manual" | null;
  draft_version: number;
  approved_by: string | null;
  approved_at: string | null;
  send_attempt_at: string | null;
  accepted_at: string | null;
  stop_reason: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export const FOLLOW_UP_LABELS: Record<FollowUpState, string> = {
  queued: "Waiting for a draft",
  drafting: "Preparing a draft",
  review: "Ready for your review",
  draft_failed: "Draft needs attention",
  sending: "Sending — confirmation pending",
  accepted: "Accepted by email service",
  send_failed: "Email was rejected",
  delivery_unknown: "Delivery needs checking",
  paused: "Paused",
  stopped: "Stopped",
};

export function followUpCanEdit(state: FollowUpState) {
  return state === "review" || state === "send_failed";
}

export function followUpNeedsAttention(state: FollowUpState) {
  return ["draft_failed", "send_failed", "delivery_unknown", "sending"].includes(state);
}
