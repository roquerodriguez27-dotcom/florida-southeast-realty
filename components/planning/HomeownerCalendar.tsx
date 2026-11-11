"use client";

import { useState } from "react";
import ReportActions from "@/components/planning/ReportActions";
import PlanHandoff from "@/components/planning/PlanHandoff";
import {
  buildHomeownerEvents, createHomeownerCalendar, formatOwnerCalendarDate,
  homeownerCalendarReport, PBC_IMPORTANT_DATES_URL,
  type HomeownerCalendarEvent,
} from "@/lib/planning/calendar";

const inputClass = "mt-2 w-full rounded-sm border border-ink/20 bg-white px-3 py-3 text-base text-ink";

export default function HomeownerCalendar() {
  const [includeHomestead, setIncludeHomestead] = useState(true);
  const [insuranceDate, setInsuranceDate] = useState("");
  const [maintenanceDate, setMaintenanceDate] = useState("");
  const [maintenanceTitle, setMaintenanceTitle] = useState("");
  const [message, setMessage] = useState("");
  let events: HomeownerCalendarEvent[] = [];
  let error = "";
  try { events = buildHomeownerEvents({ includeHomestead, insuranceDate, maintenanceDate, maintenanceTitle }); }
  catch (problem) { error = problem instanceof Error ? problem.message : "Check the dates you entered."; }
  const report = !error && events.length ? homeownerCalendarReport(events) : "";

  function downloadCalendar() {
    try {
      const content = createHomeownerCalendar(events);
      const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "FSR-homeowner-calendar.ics";
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Your calendar file is ready to import. Open it in your calendar app, review the events, and choose your reminders there.");
    } catch (problem) {
      setMessage(problem instanceof Error ? problem.message : "The calendar could not be created. Check your dates and try again.");
    }
  }

  return (
    <section id="calendar" aria-labelledby="owner-calendar-title" className="scroll-mt-28 rounded-sm border border-tide/15 bg-white p-5 sm:p-8">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-hibiscus">Keep the next steps visible</p>
      <h2 id="owner-calendar-title" className="mt-2 font-display text-3xl text-tide">Build your homeowner calendar</h2>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink/70">Keep track of important homeownership dates. Choose whether to include the official 2027 Palm Beach County homestead filing deadline, then add your own insurance renewal or maintenance reminders. This downloads a calendar file; it does not automatically send alerts.</p>

      <fieldset className="mt-6 rounded-sm bg-keystone/60 p-4 sm:p-5">
        <legend className="px-1 text-sm font-semibold text-tide">Official Palm Beach County date</legend>
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-ink/80">
          <input type="checkbox" checked={includeHomestead} onChange={(event) => { setIncludeHomestead(event.target.checked); setMessage(""); }} className="mt-1 h-5 w-5 shrink-0 accent-tide" />
          <span><strong className="block text-base text-ink">March 1, 2027 · Homestead filing deadline</strong>Include this date if you need to apply for the 2027 tax year. Confirm your eligibility and application requirements with the Property Appraiser.</span>
        </label>
        <p className="mt-3 text-xs leading-relaxed text-ink/65">The county lists March 1, or the next business day when it falls on a weekend. March 1, 2027 is a Monday. <a href={PBC_IMPORTANT_DATES_URL} target="_blank" rel="noopener noreferrer" className="text-tide underline underline-offset-4">Read the official dates<span className="sr-only"> (opens in a new tab)</span></a>.</p>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-tide">Add your own reminders (optional)</legend>
        <div className="mt-3 grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="owner-insurance-date" className="text-sm font-medium text-ink">Insurance renewal or review date</label>
            <input id="owner-insurance-date" type="date" value={insuranceDate} onChange={(event) => { setInsuranceDate(event.target.value); setMessage(""); }} className={inputClass} aria-describedby="owner-insurance-help" />
            <p id="owner-insurance-help" className="mt-2 text-xs leading-relaxed text-ink/60">Use your policy or agent’s instructions. Some action may be needed before renewal.</p>
          </div>
          <div>
            <label htmlFor="owner-maintenance-date" className="text-sm font-medium text-ink">Maintenance date</label>
            <input id="owner-maintenance-date" type="date" value={maintenanceDate} onChange={(event) => { setMaintenanceDate(event.target.value); setMessage(""); }} className={inputClass} aria-describedby="owner-maintenance-help" />
            <p id="owner-maintenance-help" className="mt-2 text-xs leading-relaxed text-ink/60">Choose a date for work you plan to arrange; this does not book a contractor.</p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="owner-maintenance-title" className="text-sm font-medium text-ink">What needs to be done?</label>
            <input id="owner-maintenance-title" type="text" value={maintenanceTitle} onChange={(event) => { setMaintenanceTitle(event.target.value); setMessage(""); }} maxLength={120} placeholder="For example, review roof and gutter maintenance" className={inputClass} aria-describedby="owner-label-help" />
            <p id="owner-label-help" className="mt-2 text-xs text-ink/60">Keep policy numbers, access codes and other sensitive details out of the label.</p>
          </div>
        </div>
      </fieldset>

      <div className="mt-7 border-t border-ink/10 pt-6" aria-live="polite">
        <h3 className="font-display text-xl text-tide">Your calendar preview</h3>
        {error ? <p role="alert" className="mt-3 text-sm text-hibiscus">{error}</p> : events.length ? (
          <ul className="mt-3 space-y-3">
            {events.map((event) => (
              <li key={event.id} className="rounded-sm border border-ink/10 p-4">
                <p className="text-sm font-semibold text-tide"><time dateTime={event.date}>{formatOwnerCalendarDate(event.date)}</time></p>
                <p className="mt-1 text-sm text-ink">{event.title}</p>
                <p className="mt-1 text-xs text-ink/60">{event.kind === "official" ? "Official published date" : "Date entered by you"} · All-day calendar event</p>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm text-ink/65">Select the filing deadline or add one of your dates to create a calendar.</p>}
      </div>
      <button type="button" onClick={downloadCalendar} disabled={!!error || !events.length} className="mt-5 rounded-sm bg-hibiscus px-5 py-3 text-sm font-semibold text-white hover:bg-hibiscus-dark disabled:cursor-not-allowed disabled:opacity-50">Download calendar (.ics)</button>
      <p className="mt-3 max-w-3xl text-xs leading-relaxed text-ink/65">Open the downloaded file in Apple Calendar, Outlook, or another app that imports calendar files. In Google Calendar, use its Import option. Review dates and add reminders in that app. This is a one-time file; it does not subscribe you to FSR emails or update itself. Repeated imports can create duplicate events.</p>
      {message && <p role="status" className="mt-3 text-sm text-tide">{message}</p>}
      {!!report && <ReportActions title="My homeowner calendar" report={report} />}
      <PlanHandoff formName="planning-owner-calendar" title="Review your homeowner plan with Roque" summary={report} successMessage="Your calendar plan and preferred reply details are saved for Roque to review. This request does not register you for calendar alerts or schedule a service visit." />
    </section>
  );
}
