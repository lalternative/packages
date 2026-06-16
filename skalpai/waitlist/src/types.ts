export type JoinReason =
  | "invalid_email"
  | "invalid_segment"
  | "already_signed_up"
  | "misconfigured"
  | "generic"

export type JoinResult = { ok: true } | { ok: false; reason: JoinReason }

export interface WaitlistSegment {
  value: string
  label: string
}

export interface WaitlistLabels {
  eyebrow: string
  title: string
  subtitle: string
  fieldEmail: string
  fieldEmailPlaceholder: string
  fieldSegment: string
  submit: string
  submitting: string
  privacy: string
  successTitle: string
  successBody: string
  errorInvalidEmail: string
  errorInvalidSegment: string
  errorAlreadySignedUp: string
  errorGeneric: string
}

export interface JoinWaitlistInput {
  email: string
  segment: string
  locale?: string
}

export interface JoinWaitlistConfig {
  baseUrl?: string
  projectId: string
  apiKey: string
}
