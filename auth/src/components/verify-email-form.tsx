import { useState, type FormEvent } from "react"
import type { VerifyEmailFormProps } from "../types"

export function VerifyEmailForm({
  email,
  onSuccess,
  authClient,
}: VerifyEmailFormProps) {
  const [otp, setOtp] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | undefined>()
  const [error, setError] = useState<string | undefined>()

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault()
    if (!otp.trim() || otp.length < 6) {
      setError("Please enter the 6-digit code")
      return
    }
    setError(undefined)
    setIsVerifying(true)
    try {
      const res = await authClient.emailOtp.verifyEmail({ email, otp })
      console.log("[verify-email] response:", JSON.stringify(res?.data), "error:", JSON.stringify(res?.error))
      if (res?.error) {
        setError(res.error.message ?? "Invalid code. Please try again.")
        return
      }
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code. Please try again.")
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    if (!email) {
      setError("Email address is not available. Please register again.")
      return
    }
    setError(undefined)
    setResendMessage(undefined)
    setIsResending(true)
    try {
      await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
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
          Verify your email
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {email ? (
            <>
              Enter the 6-digit code sent to{" "}
              <span className="font-medium text-foreground">{email}</span>
            </>
          ) : (
            "Enter the 6-digit code sent to your email"
          )}
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

      <form onSubmit={handleVerify} className="space-y-4" noValidate>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          required
          disabled={isVerifying}
          autoComplete="one-time-code"
          className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-center text-lg tracking-[0.4em] font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
        />

        <button
          type="submit"
          disabled={isVerifying || otp.length < 6}
          className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {isVerifying ? "Verifying..." : "Verify email"}
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
        Already verified?{" "}
        <a
          href="/login"
          className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/80"
        >
          Sign in
        </a>
      </p>
    </div>
  )
}
