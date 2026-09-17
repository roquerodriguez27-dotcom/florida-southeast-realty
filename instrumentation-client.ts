// Runs in real browsers before the app hydrates. This lightweight cookie lets
// the server distinguish normal browser sessions from raw HTTP clients that
// merely copy browser headers. It contains no personal data and expires after
// six hours.
if (typeof document !== "undefined" && !document.cookie.includes("fsr_browser_verified=1")) {
  document.cookie = "fsr_browser_verified=1; Max-Age=21600; Path=/; SameSite=Lax; Secure";
}
