# Florida Southeast Realty planning tools

## Start here

The public hub is `/planning`. The header, homepage, footer, research page and
property details lead into the tools. Visitors can explore without entering
contact details. Worksheets provide a complete plain-text report, a separate
print window for printing or saving as PDF, and a device sharing action with a
download fallback. Entries are not placed in URL query strings.

| Idea | Working first version | Broker follow-through |
| --- | --- | --- |
| Seller proceeds | `/planning/sell?tool=proceeds`; three prices and separate editable costs, credits and payoff inputs | Confirm price assumptions, payoffs and closing estimates |
| Sell first / buy first | `/planning/sell?tool=timing`; dates, preparation assumptions and gap/overlap costs | Confirm financing, possession, availability of sale proceeds and actual agreements |
| Preparation review | `/planning/sell?tool=prepare`; condition topics, records, budget and questions | Review the property; arrange any photos or documents through an agreed channel |
| Offer comparison | `/planning/sell?tool=offers`; up to three offers, individual concessions and terms | Review the actual offers; the worksheet selects no winner |
| Weekly seller report | `/planning/sell?tool=report`; manually entered activity, sources, date range and next steps | Verify figures and agree on reporting day and delivery |
| Buyer cost report | `/buyer-tools`; full assumptions and comparison details included in print/share/handoff | Review with buyer and relevant lender or insurer |
| Property checklist | `/planning/buy?tool=checklist`; ten research areas with statuses and notes | Obtain records and specialist answers |
| Relocation visit | `/planning/buy?tool=relocation`; timing, areas, priorities and research blocks | Confirm property availability and actual appointments |
| Tour scorecard | `/planning/buy?tool=tour`; personal ratings, observations and questions | Investigate unresolved issues before the next decision |
| Loan Estimate comparison | `/planning/buy?tool=loans`; up to three manually entered estimates | Have lenders explain costs, assumptions and terms |
| Homeowner calendar | `/planning/own#calendar`; one-time `.ics` export with the 2027 PBC filing date and the owner's dates | Owner imports and sets reminders in their calendar app |
| Property-record alerts | `/planning/own#property-alerts`; official Clerk registration link | Owner registers directly with the Clerk |
| Amendment 3 estimator | `/research/homeowner-updates` and `/planning/own`; official PBC estimator link with limits | Confirm eligibility and use official updates for certification status |
| Voice or typed question | `/ask-roque`; browser dictation when supported, transcript review and typed fallback | Reply to the specific submitted question |
| Broker videos and real case studies | Six scripts, recording guide and actual-transaction intake template in the docs below | Roque's recordings and permissioned real case facts are still required |
| Inquiry outcomes | Private `/crm/outcomes`; inquiry records, recorded conversations, booked/held appointments and current closed stage | Record actual interactions using each lead's contact-outcome form |

## Receiving and answering a request

Each planning form has its own fixed `planning-*` identifier. Email or a usable
phone number is sufficient. The visitor can provide a preferred reply method
and time, and must consent to contact about the request. The complete report is
split into bounded `plan_summary` fields if needed; no report content is silently
truncated. A request exceeding the existing byte limit stays on screen for the
visitor to shorten or download.

The existing lead API stores the request in the private CRM, then attempts the
existing broker email notification. The UI distinguishes saved requests from
unconfirmed email delivery. No new client email/text sequence is activated by
these tools. A visitor's preferred time is not an appointment confirmation.

Read every report part in the lead's submitted details. Contact the visitor in
the way requested, verify assumptions, then record the real contact outcome.
Completing a task does not mark a conversation. Completing an automatic reminder
clears only its matching follow-up date, protecting newer reschedules.

If a visitor edits the worksheet after submission, the page identifies the
unsent revision and offers **Send updated request**. Contact details are retained
for that reset, while consent must be checked again.

## Outcome report meanings

The report groups inquiry records created within the chosen 30-, 90- or 365-day
window. It applies existing broker/assigned-agent row access. Each record counts
once for each recorded outcome, even if several interactions are logged.

- An unanswered attempt is distinct from a two-way conversation or reply.
- Booked and held appointments are recorded separately; a held appointment also
  counts as a conversation.
- Closed is the lead's current CRM stage. It does not verify a settlement,
  commission or revenue.
- Existing notes and completed tasks are not retroactively treated as contact.
- Multiple requests from one person remain separate inquiry records.

The report paginates results and labels a partial result if its explicit safety
limit is reached. Use a shorter period if that notice appears.

## Content requiring real material

- `docs/broker-video-scripts.md`: six complete spoken drafts.
- `docs/broker-video-recording-guide.md`: recording, captions and publication log.
- `docs/broker-case-study-intake.md`: real facts, evidence and publication permission.
- `docs/seller-weekly-report-fulfillment.md`: actual activity sources and delivery workflow.

No video or client case study is represented as already recorded or published.
No ad budget, social post, client message or automatic weekly report is launched
by this release.

## Maintaining dated material

The existing **FSR Homeowner Updates** task maintains the sourced JSON under
`docs/homeowner-updates-maintenance.md`. The Amendment 3 estimator is a resource,
not proof of certification. Previous source-check dates remain unchanged unless
those sources are actually reviewed again.

The owner calendar explicitly covers the **2027** homestead filing date. Review
that dated copy and its official source before advancing to another filing year.
Downloaded calendar files do not update themselves. Insurance and maintenance
dates are supplied by the owner; the site does not invent policy or appeal dates.

Dictation depends on the visitor's browser and speech provider. It starts only
after an explicit action; the visitor reviews the transcript before sending.
The website stores no audio recording. Typed input always remains available.

## Release checks

Use `npm run test:planning-suite`, `npm run test:analytics-privacy`,
`npm run test:homeowner-updates`, `npm run lint` and `npm run build`.
The focused checks cover calculations, missing values, complete reports,
phone-only validation, consent, analytics privacy, CRM contact semantics,
rescheduled reminders, speech fallback and safe calendar exports.

Database migrations preserve the existing write-only capture functions and
private row access. Database checks use rolled-back synthetic fixtures, not
real client messages. The preview should be checked for the buyer/seller/owner
routes, print/download actions, voice text fallback, private-route login guard
and the new navigation before merging and verifying production.
