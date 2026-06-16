export type BetaBadgeVariant =
  | "alpha"
  | "beta"
  | "early-access"
  | "preview"
  | "pre-launch"

export interface BetaBadgeProps {
  variant?: BetaBadgeVariant
  className?: string
}

const LABELS: Record<BetaBadgeVariant, string> = {
  alpha: "ALPHA",
  beta: "BETA",
  "early-access": "EARLY ACCESS",
  preview: "PREVIEW",
  "pre-launch": "PRE-LAUNCH",
}

export function BetaBadge({ variant = "beta", className }: BetaBadgeProps) {
  const cls = [
    "inline-flex items-center bg-primary/10 text-primary text-xs font-medium uppercase tracking-wider rounded-full px-2 py-0.5",
    className,
  ]
    .filter(Boolean)
    .join(" ")
  return <span className={cls}>{LABELS[variant]}</span>
}
