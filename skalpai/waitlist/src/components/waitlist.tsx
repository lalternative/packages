import { useState, type FormEvent } from "react"
import { Check } from "lucide-react"
import type { JoinResult, WaitlistLabels, WaitlistSegment } from "../types"

export interface WaitlistProps {
  segments: WaitlistSegment[]
  labels: WaitlistLabels
  onSubmit: (input: { email: string; segment: string }) => Promise<JoinResult>
  className?: string
  id?: string
}

export function Waitlist({
  segments,
  labels,
  onSubmit,
  className,
  id = "waitlist",
}: WaitlistProps) {
  const [email, setEmail] = useState("")
  const [segment, setSegment] = useState<string>(segments[0]?.value ?? "")
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<JoinResult | null>(null)
  const [submissionFailed, setSubmissionFailed] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setPending(true)
    setSubmissionFailed(false)
    try {
      const res = await onSubmit({ email, segment })
      setResult(res)
    } catch {
      setSubmissionFailed(true)
      setResult(null)
    } finally {
      setPending(false)
    }
  }

  const succeeded = result?.ok === true
  const errorReason =
    result && !result.ok ? result.reason : submissionFailed ? "generic" : null

  const errorMessage =
    errorReason === "invalid_email"
      ? labels.errorInvalidEmail
      : errorReason === "invalid_segment"
        ? labels.errorInvalidSegment
        : errorReason === "already_signed_up"
          ? labels.errorAlreadySignedUp
          : errorReason
            ? labels.errorGeneric
            : null

  const sectionClass = [
    "border-b border-border/60 bg-gradient-to-b from-accent/30 to-transparent",
    className,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <section id={id} className={sectionClass}>
      <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
        <div className="text-center">
          <span className="text-xs font-medium uppercase tracking-wider text-primary">
            {labels.eyebrow}
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {labels.title}
          </h2>
          <p className="mt-4 text-base text-muted-foreground">{labels.subtitle}</p>
        </div>

        {succeeded ? (
          <div className="mt-10 rounded-xl border border-primary/30 bg-card p-8 text-center shadow-sm">
            <div className="bg-primary/10 text-primary mx-auto inline-flex size-12 items-center justify-center rounded-full">
              <Check className="size-6" />
            </div>
            <h3 className="mt-4 text-xl font-semibold">{labels.successTitle}</h3>
            <p
              className="mt-2 text-sm text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: labels.successBody }}
            />
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-10 space-y-5 rounded-xl border border-border/70 bg-card p-6 shadow-sm sm:p-8"
          >
            <div className="space-y-2">
              <label
                htmlFor={`${id}-email`}
                className="text-sm font-medium leading-none"
              >
                {labels.fieldEmail}
              </label>
              <input
                id={`${id}-email`}
                type="email"
                required
                autoComplete="email"
                placeholder={labels.fieldEmailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={errorReason === "invalid_email"}
                disabled={pending}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">{labels.fieldSegment}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {segments.map((s) => (
                  <label
                    key={s.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors ${
                      segment === s.value
                        ? "border-primary bg-primary/5"
                        : "border-border/70 hover:border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${id}-segment`}
                      value={s.value}
                      checked={segment === s.value}
                      onChange={() => setSegment(s.value)}
                      className="mt-0.5 accent-primary"
                      disabled={pending}
                    />
                    <span>{s.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {errorMessage && (
              <p className="text-sm text-destructive" role="alert">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-11 w-full items-center justify-center whitespace-nowrap rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? labels.submitting : labels.submit}
            </button>

            <p className="text-center text-xs text-muted-foreground">{labels.privacy}</p>
          </form>
        )}
      </div>
    </section>
  )
}
