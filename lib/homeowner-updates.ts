import { z } from "zod";
import content from "../data/homeowner-updates.json";

export const HOMEOWNER_UPDATES_PATH = "/research/homeowner-updates";
export const HOMEOWNER_UPDATES_TITLE = "Florida Homeowner Updates";
export const HOMEOWNER_UPDATES_DESCRIPTION =
  "Official-source updates on Florida property taxes, condo reserves and assessments, and Citizens flood insurance, with practical questions for buyers and homeowners.";

const OFFICIAL_SOURCE_HOSTS = new Set([
  "constitutionalinitiatives.dos.fl.gov",
  "dos.fl.gov",
  "floridaelectionwatch.gov",
  "flsenate.gov",
  "www.flsenate.gov",
  "condos.myfloridalicense.com",
  "citizensfla.com",
  "www.citizensfla.com",
  "pbcpao.gov",
]);

const ELECTION_SOURCE_HOSTS = new Set([
  "constitutionalinitiatives.dos.fl.gov",
  "dos.fl.gov",
  "floridaelectionwatch.gov",
]);

const topicIds = [
  "amendment-3-2026",
  "condo-reserves-and-assessments",
  "citizens-flood-insurance",
] as const;

const text = (max: number) => z.string().trim().min(1).max(max)
  .refine((value) => !/[<>\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value), "Use plain text, without HTML or control characters.");
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
// Maintenance stores UTC timestamps; the UI formats them in Eastern Time.
const date = z.iso.datetime();

export function isOfficialHomeownerSource(value: string): boolean {
  if (value !== value.trim() || /[\\\u0000-\u0020]/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port
      && OFFICIAL_SOURCE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function isSafeActionLink(value: string): boolean {
  if (isOfficialHomeownerSource(value)) return true;
  return /^\/(?!\/)/.test(value) && !/[\\<>\u0000-\u0020]/.test(value)
    && !/^\/(?:api|crm)(?:[/?#]|$)/i.test(value);
}

const sourceSchema = z.object({
  id,
  label: text(180),
  url: z.string().refine(isOfficialHomeownerSource, "Source must use an approved official HTTPS host."),
  lastSuccessfulCheckAt: date,
  accessMethod: z.enum(["direct", "official-index"]),
}).strict();

const topicSchema = z.object({
  id: z.enum(topicIds),
  title: text(180),
  summary: text(700),
  status: z.object({
    code: z.enum(["unofficial-results", "certified", "in-effect", "scheduled", "guidance", "under-review"]),
    label: text(100),
    detail: text(1000),
  }).strict(),
  appliesTo: text(1000),
  publishedAt: date,
  editorialUpdatedAt: date,
  facts: z.array(z.object({ id, text: text(2400), sourceIds: z.array(id).min(1).max(12) }).strict()).min(1).max(16),
  actions: z.array(z.object({
    text: text(1000),
    href: z.string().refine(isSafeActionLink, "Action must use a safe local link or an approved official source.").optional(),
  }).strict()).min(1).max(10),
  sources: z.array(sourceSchema).min(1).max(12),
}).strict();

export const homeownerUpdatesSchema = z.object({
  schemaVersion: z.literal(1),
  publishedAt: date,
  editorialUpdatedAt: date,
  topics: z.array(topicSchema).length(topicIds.length),
  history: z.array(z.object({
    at: date,
    summary: text(1200),
    topicIds: z.array(z.enum(topicIds)).min(1).max(topicIds.length),
  }).strict()).min(1).max(100),
}).strict().superRefine((value, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
  const unique = (values: string[], path: (string | number)[]) => {
    if (new Set(values).size !== values.length) issue(path, "IDs must be unique within this collection.");
  };
  unique(value.topics.map((topic) => topic.id), ["topics"]);
  if (Date.parse(value.editorialUpdatedAt) < Date.parse(value.publishedAt)) {
    issue(["editorialUpdatedAt"], "An editorial update cannot precede publication.");
  }
  value.topics.forEach((topic, index) => {
    const path = ["topics", index];
    unique(topic.sources.map((source) => source.id), [...path, "sources"]);
    unique(topic.facts.map((fact) => fact.id), [...path, "facts"]);
    if (Date.parse(topic.editorialUpdatedAt) < Date.parse(topic.publishedAt)) {
      issue([...path, "editorialUpdatedAt"], "An editorial update cannot precede publication.");
    }
    if (Date.parse(topic.editorialUpdatedAt) > Date.parse(value.editorialUpdatedAt)) {
      issue(["editorialUpdatedAt"], "The page editorial date must include its latest topic update.");
    }
    const sources = new Map(topic.sources.map((source) => [source.id, source]));
    topic.facts.forEach((fact, factIndex) => {
      unique(fact.sourceIds, [...path, "facts", factIndex, "sourceIds"]);
      fact.sourceIds.forEach((sourceId) => {
        if (!sources.has(sourceId)) issue([...path, "facts", factIndex, "sourceIds"], `Unknown source: ${sourceId}`);
      });
    });
    if (["unofficial-results", "certified"].includes(topic.status.code) && topic.id !== "amendment-3-2026") {
      issue([...path, "status", "code"], "Election-result statuses belong to the Amendment topic.");
    }
    if (topic.id === "amendment-3-2026" && ["certified", "in-effect"].includes(topic.status.code)) {
      // A badge change alone cannot promote an unofficial result. Maintenance
      // must add a distinct, cited certification fact after reading the source.
      const certification = topic.facts.find((fact) => fact.id === "certification");
      const hasDirectElectionEvidence = certification?.sourceIds.some((sourceId) => {
        const source = sources.get(sourceId);
        return source?.accessMethod === "direct" && isOfficialHomeownerSource(source.url)
          && ELECTION_SOURCE_HOSTS.has(new URL(source.url).hostname);
      });
      if (!hasDirectElectionEvidence) {
        issue([...path, "status", "code"], "Certified Amendment status requires a certification fact citing a directly reviewed official election source.");
      }
      if (topic.status.code === "in-effect") {
        const effectiveDate = topic.facts.find((fact) => fact.id === "effective-date");
        if (!effectiveDate?.sourceIds.some((sourceId) => sources.get(sourceId)?.accessMethod === "direct")) {
          issue([...path, "status", "code"], "An in-effect Amendment requires an effective-date fact citing a directly reviewed official source.");
        }
      }
    }
  });
  value.history.forEach((entry, index) => {
    unique(entry.topicIds, ["history", index, "topicIds"]);
    if (Date.parse(entry.at) > Date.parse(value.editorialUpdatedAt)) {
      issue(["history", index, "at"], "Change history cannot be newer than the page editorial date.");
    }
  });
});

export type HomeownerUpdates = z.infer<typeof homeownerUpdatesSchema>;
export type HomeownerTopic = HomeownerUpdates["topics"][number];

export const HOMEOWNER_UPDATES = homeownerUpdatesSchema.parse(content);

export function formatHomeownerDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York",
  }).format(Date.parse(value));
}

export function sourcesReviewedAt(topics: readonly HomeownerTopic[]): string {
  return topics.flatMap((topic) => topic.sources)
    .reduce((oldest, source) => Date.parse(source.lastSuccessfulCheckAt) < Date.parse(oldest)
      ? source.lastSuccessfulCheckAt : oldest, topics[0].sources[0].lastSuccessfulCheckAt);
}
