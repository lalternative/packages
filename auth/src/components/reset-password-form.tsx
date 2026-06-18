import { useState, type FormEvent } from "react"
import type { ResetPasswordFormProps } from "../types"

export function ResetPasswordForm({
  email,
  onSuccess,
  loginUrl = "/login",
  authClient,
}: ResetPasswordFormProps) {
  const [otp, setOtp] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | undefined>()
  const [isResetting, setIsResetting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | undefined>()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!otp.trim() || otp.length < 6) {
      setError("Please enter the 6-digit code")
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }
    setError(undefined)
    setIsResetting(true)
    try {
      const res = await fetch("/api/auth/email-otp/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, password }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.message ?? "Failed to reset password")
        return
      }
      onSuccess?.()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to reset password",
      )
    } finally {
      setIsResetting(false)
    }
  }

  const handleResend = async () => {
    setError(undefined)
    setResendMessage(undefined)
    setIsResending(true)
    try {
      await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "forget-password",
      })
      setResendMessage("A new code has been sent to your inbox.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend code.")
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Reset your password
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the 6-digit code sent to{" "}
          <span className="font-medium text-foreground">{email}</span> and your
          new password.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {resendMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
          {resendMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          required
          disabled={isResetting}
          autoComplete="one-time-code"
          className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-center text-lg tracking-[0.4em] font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          required
          disabled={isResetting}
          autoComplete="new-password"
          className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
        />

        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          required
          disabled={isResetting}
          autoComplete="new-password"
          className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
        />

        <button
          type="submit"
          disabled={isResetting || otp.length < 6 || !password}
          className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {isResetting ? "Resetting..." : "Reset password"}
        </button>

        <button
          type="button"
          onClick={handleResend}
          disabled={isResending}
          className="inline-flex h-11 w-full items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          {isResending ? "Sending..." : "Resend code"}
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
