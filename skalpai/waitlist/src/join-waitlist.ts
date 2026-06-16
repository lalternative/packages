import type {
  JoinResult,
  JoinWaitlistConfig,
  JoinWaitlistInput,
} from "./types"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Submit an email to the Skalpai waitlist endpoint.
 *
 * Framework-agnostic: the caller is responsible for keeping `apiKey` off the
 * client by wrapping this function in a server-side handler (TanStack Start
 * `createServerFn`, Next.js Route Handler, etc.).
 */
export async function joinWaitlist(
  input: JoinWaitlistInput,
  config: JoinWaitlistConfig,
  // segments is optional — if provided, the function validates the segment
  // against the allowed list. Otherwise any non-empty string is accepted.
  allowedSegments?: readonly string[],
): Promise<JoinResult> {
  const email = (input.email ?? "").trim().toLowerCase()
  if (!EMAIL_RE.test(email) || email.length > 320) {
    return { ok: false, reason: "invalid_email" }
  }

  const segment = (input.segment ?? "").trim()
  if (!segment) {
    return { ok: false, reason: "invalid_segment" }
  }
  if (allowedSegments && !allowedSegments.includes(segment)) {
    return { ok: false, reason: "invalid_segment" }
  }

  const { projectId, apiKey } = config
  if (!projectId || !apiKey) {
    console.error("[waitlist] projectId or apiKey missing")
    return { ok: false, reason: "misconfigured" }
  }

  const baseUrl = config.baseUrl ?? "https://api.skalpai.dev"
  const locale = input.locale === "fr" ? "fr" : "en"
  const reason = `segment=${segment};locale=${locale}`

  try {
    const res = await fetch(`${baseUrl}/api/projects/${projectId}/waitlist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({ email, reason }),
    })
    if (res.status === 201) return { ok: true }
    if (res.status === 400) {
      const body = await res.text()
      const lower = body.toLowerCase()
      if (lower.includes("exist") || lower.includes("duplicate")) {
        return { ok: false, reason: "already_signed_up" }
      }
      return { ok: false, reason: "invalid_email" }
    }
    console.error("[waitlist] skalpai responded", res.status, await res.text())
    return { ok: false, reason: "generic" }
  } catch (err) {
    console.error("[waitlist] fetch failed", err)
    return { ok: false, reason: "generic" }
  }
}
