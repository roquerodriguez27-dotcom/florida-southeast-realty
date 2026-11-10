"use client";

import { useState } from "react";
import { SITE } from "@/lib/site-config";

export default function ReportActions({ title, report }: { title: string; report: string }) {
  const [message, setMessage] = useState("");
  function completeReport() {
    return `${SITE.name}\n${title}\nPrepared ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} Eastern\n\n${report}\n\n${SITE.phoneDisplay} · ${SITE.url}\nPlanning worksheet. Confirm estimates, documents and deadlines with the appropriate professionals.\n`;
  }
  function download() {
    const blob = new Blob([completeReport()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `FSR-${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0,90)}.txt`;
    document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Your report download has started. Keep it somewhere private if it includes personal details.");
  }
  function print() {
    const popup = window.open("", "_blank", "width=900,height=750");
    if (!popup) { setMessage("Allow a print window for this site, or download the text report."); return; }
    popup.opener = null;
    popup.document.title = title;
    const style = popup.document.createElement("style");
    style.textContent = "body{font-family:Arial,sans-serif;color:#123b3b;margin:42px;line-height:1.55}h1{font-size:25px}pre{font:13px/1.6 Arial,sans-serif;white-space:pre-wrap;overflow-wrap:anywhere;color:#263b3b}button{padding:10px 18px;background:#123b3b;color:white;border:0;margin-bottom:24px}@media print{button{display:none}body{margin:0}@page{margin:18mm}}";
    popup.document.head.append(style);
    const heading = popup.document.createElement("h1"); heading.textContent = title;
    const content = popup.document.createElement("pre"); content.textContent = completeReport();
    const button = popup.document.createElement("button"); button.textContent = "Print or Save as PDF";
    button.onclick = () => popup.print();
    popup.document.body.append(button, heading, content);
    popup.focus();
    setMessage("Your printable report is open in a new window. Choose Print or Save as PDF there.");
  }
  async function share() {
    if (!navigator.share) { download(); return; }
    try { await navigator.share({ title, text: completeReport() }); setMessage("Your device’s sharing window handled the report."); }
    catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setMessage("Sharing is unavailable here. Download the report or use Print / PDF."); }
  }
  return (
    <div className="mt-5 border-t border-ink/10 pt-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={print} className="rounded-sm bg-tide px-4 py-2.5 text-sm font-medium text-white">Print / PDF</button>
        <button type="button" onClick={download} className="rounded-sm border border-tide/25 px-4 py-2.5 text-sm font-medium text-tide hover:bg-tide/5">Download report</button>
        <button type="button" onClick={share} className="rounded-sm border border-tide/25 px-4 py-2.5 text-sm font-medium text-tide hover:bg-tide/5">Share report</button>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink/55">Save your report before leaving this page. Your entries stay in this page unless you choose to send or share them. On browsers without device sharing, Share downloads a copy.</p>
      {message && <p role="status" className="mt-2 text-sm text-tide">{message}</p>}
    </div>
  );
}
