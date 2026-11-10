"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import PlanHandoff from "@/components/planning/PlanHandoff";

type SpeechResult = { isFinal: boolean; length: number; [index: number]: { transcript: string } };
type SpeechEvent = { results: { length: number; [index: number]: SpeechResult } };
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type RecognitionConstructor = new () => Recognition;
type SpeechWindow = Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
const subscribe = () => () => {};
function recognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const browser = window as SpeechWindow;
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}

export default function VoiceQuestion() {
  const supported = useSyncExternalStore(subscribe, () => Boolean(recognitionConstructor()), () => false);
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const recognition = useRef<Recognition | null>(null);

  useEffect(() => {
    function pause() {
      if (document.visibilityState === "hidden") {
        recognition.current?.abort();
        setListening(false);
        setReviewed(false);
      }
    }
    document.addEventListener("visibilitychange", pause);
    return () => {
      document.removeEventListener("visibilitychange", pause);
      const active = recognition.current;
      if (active) {
        active.onresult = null;
        active.onerror = null;
        active.onend = null;
        active.abort();
      }
    };
  }, []);

  function start() {
    const Constructor = recognitionConstructor();
    if (!Constructor || listening) return;
    setReviewed(false);
    setMessage("");
    const base = transcript.trim();
    try {
      const active = new Constructor();
      let limitReached = false;
      recognition.current = active;
      active.lang = "en-US";
      active.continuous = false;
      active.interimResults = true;
      active.maxAlternatives = 1;
      active.onresult = event => {
        if (recognition.current !== active) return;
        const phrases: string[] = [];
        for (let index = 0; index < event.results.length; index++) phrases.push(event.results[index][0]?.transcript ?? "");
        const combined = [base, phrases.join(" ")].filter(Boolean).join(" ");
        setTranscript(combined.slice(0, 3000));
        setReviewed(false);
        if (combined.length > 3000 && !limitReached) {
          limitReached = true;
          setListening(false);
          setMessage("The 3,000-character limit was reached. Review the last sentence and shorten or edit the text before sending.");
          active.stop();
        }
      };
      active.onerror = event => {
        if (recognition.current !== active) return;
        setListening(false);
        setReviewed(false);
        if (limitReached) return;
        setMessage(event.error === "not-allowed" || event.error === "service-not-allowed" ? "Microphone or speech access was not allowed. You can type your question below." : event.error === "no-speech" ? "No speech was detected. Try again or type your question." : event.error === "aborted" ? "Dictation stopped. Review or edit the text below." : "Dictation is unavailable right now. You can type or edit your question below.");
      };
      active.onend = () => {
        if (recognition.current !== active) return;
        setListening(false);
      };
      active.start();
      setListening(true);
    } catch {
      setListening(false);
      setMessage("This browser could not start dictation. You can type your question below.");
    }
  }

  function stop() {
    try { recognition.current?.stop(); } catch { recognition.current?.abort(); }
    setListening(false);
    setReviewed(false);
    setMessage("Dictation stopped. Check the text and make any changes before sending.");
  }

  return <section className="rounded-sm border border-tide/20 bg-white p-5 md:p-8" aria-labelledby="voice-question-heading">
    <h2 id="voice-question-heading" className="font-display text-2xl">Ask in your own words</h2>
    <p className="mt-3 text-sm text-ink/65">Type a question, or use your browser’s dictation if available. Nothing is sent to Roque until you review the text and submit the contact form.</p>
    <div className="mt-4 flex flex-wrap gap-3 items-center">
      {supported ? <button type="button" onClick={listening ? stop : start} className="rounded-sm bg-tide px-4 py-2.5 text-sand font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tide">{listening ? "Stop dictation" : "Start dictation"}</button> : <p className="text-sm text-ink/65">Dictation is not supported in this browser. The text field is ready to use.</p>}
      <span role="status" className="text-sm text-tide">{listening ? "Listening. Speak your question, then stop and review." : message}</span>
    </div>
    <p className="mt-3 text-xs text-ink/60">Your browser may send audio to its speech service for processing. FSR does not store a recording. Only the text you choose to submit is included in your inquiry.</p>
    <label className="block mt-5"><span className="block text-sm font-medium mb-2">Your question</span><textarea rows={6} maxLength={3000} readOnly={listening} value={transcript} onChange={event => { setTranscript(event.target.value); setReviewed(false); }} className="w-full rounded-sm border border-ink/20 p-3 focus:border-tide focus:ring-2 focus:ring-tide/20 outline-none" placeholder="What would you like to know about buying, selling or a property?" /></label>
    <p className="mt-1 text-xs text-ink/60">{transcript.length} / 3,000 characters.{listening ? " Stop dictation to edit." : " You can correct every word before sending."}</p>
    <label className="mt-4 flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-4 accent-tide" checked={reviewed} disabled={listening || !transcript.trim()} onChange={event => setReviewed(event.target.checked)} /><span>I have reviewed this text and want to include it in my inquiry.</span></label>
    {reviewed && !listening && transcript.trim() && <div className="mt-6"><PlanHandoff formName="planning-voice-question" title="Choose how Roque can reply" summary={transcript.trim()} successMessage="Your reviewed question has been saved for Roque. He will follow up using the contact details you provide." /></div>}
  </section>;
}
