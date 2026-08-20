import "server-only";

type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; status: number; reason: "invalid_payload" | "request_too_large" | "invalid_origin" };

function requestHost(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  return forwardedHost || request.headers.get("host")?.trim() || "";
}

export async function readSameOriginJson(
  request: Request,
  maxBytes = 32_768,
): Promise<JsonBodyResult> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return { ok: false, status: 415, reason: "invalid_payload" };
  }

  const origin = request.headers.get("origin");
  const host = requestHost(request);
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return { ok: false, status: 403, reason: "invalid_origin" };
      }
    } catch {
      return { ok: false, status: 403, reason: "invalid_origin" };
    }
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { ok: false, status: 413, reason: "request_too_large" };
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    return { ok: false, status: 413, reason: "request_too_large" };
  }

  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, status: 400, reason: "invalid_payload" };
  }
}
