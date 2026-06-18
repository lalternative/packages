import type { AuthLayoutProps } from "../types"

export function AuthLayout({
  logo,
  title,
  subtitle,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          {logo && <div className="mb-6 flex justify-center">{logo}</div>}
          <h1 className="text-[32px] font-light tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>

        <div className="rounded-xl border bg-card p-8 shadow-sm">
          {children}
        </div>

        {footer && (
          <div className="mt-6 text-center text-xs text-muted-foreground">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
