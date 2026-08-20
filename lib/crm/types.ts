export const CRM_STATUSES = ["new", "contacted", "qualified", "appointment", "active", "closed", "lost"] as const;
export type CrmStatus = (typeof CRM_STATUSES)[number];

export interface CrmLead {
  id: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  source: string;
  form_name: string;
  status: CrmStatus;
  priority: "low" | "normal" | "high" | "urgent";
  property_interest: string | null;
  message: string | null;
  fields: Record<string, string>;
  next_follow_up_at: string | null;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
}
