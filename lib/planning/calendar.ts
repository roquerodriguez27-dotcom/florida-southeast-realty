export const PBC_IMPORTANT_DATES_URL = "https://pbcpao.gov/important-dates.htm";
export const HOMESTEAD_FILING_DATE = "2027-03-01";

export interface HomeownerCalendarEvent {
  id: string;
  title: string;
  date: string;
  description: string;
  sourceUrl?: string;
  kind: "official" | "personal";
}

export interface HomeownerCalendarInput {
  includeHomestead: boolean;
  insuranceDate: string;
  maintenanceDate: string;
  maintenanceTitle: string;
}

function calendarDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Choose a complete calendar date.");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error("Choose a valid calendar date.");
  }
  if (parsed.getUTCFullYear() < 1900 || parsed.getUTCFullYear() > 9998) {
    throw new Error("Choose a calendar year between 1900 and 9998.");
  }
  return parsed;
}

export function formatOwnerCalendarDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(calendarDate(value));
}

export function buildHomeownerEvents(input: HomeownerCalendarInput): HomeownerCalendarEvent[] {
  const events: HomeownerCalendarEvent[] = [];
  if (input.maintenanceTitle.trim() && !input.maintenanceDate) {
    throw new Error("Add a maintenance date for your label, or clear the label.");
  }
  if (input.includeHomestead) events.push({
    id: "pbc-homestead-2027",
    title: "Palm Beach County: 2027 homestead filing deadline",
    date: HOMESTEAD_FILING_DATE,
    description: "Palm Beach County lists March 1 (next business day if on a weekend) as the filing deadline for the current tax year. March 1, 2027 is a Monday. Confirm eligibility and your application with the Property Appraiser. Adding a calendar event does not file an application.",
    sourceUrl: PBC_IMPORTANT_DATES_URL,
    kind: "official",
  });
  if (input.insuranceDate) {
    calendarDate(input.insuranceDate);
    events.push({
      id: "owner-insurance",
      title: "Home insurance renewal or review — your date",
      date: input.insuranceDate,
      description: "Date entered by the homeowner. Confirm policy renewal, required documents and any earlier action deadline with your insurance agent.",
      kind: "personal",
    });
  }
  if (input.maintenanceDate) {
    calendarDate(input.maintenanceDate);
    const title = input.maintenanceTitle.trim() || "Home maintenance review";
    if (title.length > 120) throw new Error("Keep the maintenance label to 120 characters.");
    events.push({
      id: "owner-maintenance",
      title,
      date: input.maintenanceDate,
      description: "Maintenance date entered by the homeowner. Confirm the work and timing with the appropriate provider. This event does not book a service visit.",
      kind: "personal",
    });
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
}

// RFC 5545 TEXT escaping prevents a label from creating another content line.
export function escapeCalendarText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;").replace(/,/g, "\\,")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

// Fold at 75 UTF-8 octets, preserving complete code points. Continuation space
// counts toward the next physical line's limit.
function foldCalendarLine(line: string): string {
  const encoder = new TextEncoder();
  let output = "";
  let octets = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (octets + size > 75) { output += "\r\n "; octets = 1; }
    output += character;
    octets += size;
  }
  return output;
}

export function createHomeownerCalendar(
  events: readonly HomeownerCalendarEvent[],
  generatedAt = new Date(),
  exportId: string = crypto.randomUUID(),
): string {
  if (!events.length || events.length > 20) throw new Error("Choose between one and twenty calendar events.");
  if (!Number.isFinite(generatedAt.getTime())) throw new Error("The calendar creation time is invalid.");
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(exportId)) throw new Error("The calendar identifier is invalid.");
  const stamp = generatedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const ids = new Set<string>();
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Florida Southeast Realty//Homeowner Calendar//EN", "CALSCALE:GREGORIAN"];
  for (const event of events) {
    if (!/^[a-z0-9-]{1,80}$/.test(event.id) || ids.has(event.id)) throw new Error("Calendar events need distinct safe identifiers.");
    ids.add(event.id);
    if (!event.title.trim() || event.title.length > 240 || event.description.length > 4000) {
      throw new Error("The calendar event text is missing or too long.");
    }
    const start = calendarDate(event.date);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${exportId}-${event.id}@floridasoutheastrealty.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${event.date.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, "")}`,
      `SUMMARY:${escapeCalendarText(event.title)}`,
      `DESCRIPTION:${escapeCalendarText(event.description + (event.sourceUrl ? `\nOfficial source: ${event.sourceUrl}` : ""))}`,
      "TRANSP:TRANSPARENT",
    );
    if (event.sourceUrl) {
      if (event.sourceUrl !== PBC_IMPORTANT_DATES_URL) throw new Error("Unexpected official calendar source.");
      lines.push(`URL:${event.sourceUrl}`);
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldCalendarLine).join("\r\n")}\r\n`;
}

export function homeownerCalendarReport(events: readonly HomeownerCalendarEvent[]): string {
  return [
    "HOMEOWNER CALENDAR",
    ...events.map((event) => `${formatOwnerCalendarDate(event.date)} — ${event.title}\n${event.kind === "official" ? "Official published date" : "Date entered by you"}\n${event.description}${event.sourceUrl ? `\nSource: ${event.sourceUrl}` : ""}`),
    "Calendar files are one-time exports. Review dates after importing and set reminders in your calendar app. Florida Southeast Realty has not enrolled you in an email reminder service. Importing again may create duplicate events.",
    "TRIM, appeal and tax-bill deadlines are not assigned by this planner. Use the actual notice and the responsible agency's current instructions.",
  ].join("\n\n");
}
