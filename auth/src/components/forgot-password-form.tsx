import { useState, type FormEvent } from "react"
import type { ForgotPasswordFormProps } from "../types"

export function ForgotPasswordForm({
  onSuccess,
  loginUrl = "/login",
  authClient,
}: ForgotPasswordFormProps) {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | undefined>()
  const [isPending, setIsPending] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError("Please enter your email address")
      return
    }
    setError(undefined)
    setIsPending(true)
    try {
      const res = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "forget-password",
      })
      if (res?.error) {
        setError(res.error.message ?? "Failed to send reset code")
        return
      }
      onSuccess?.(email)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset code")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Forgot your password?
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your email address and we'll send you a code to reset your
          password.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          required
          disabled={isPending}
          autoComplete="email"
          className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
        />

        <button
          type="submit"
          disabled={isPending || !email.trim()}
          className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {isPending ? "Sending..." : "Send reset code"}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Remember your password?{" "}
        <a
          href={loginUrl}
          className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/80"
        >
          Sign in
        </a>
      </p>
    </div>
  )
}
