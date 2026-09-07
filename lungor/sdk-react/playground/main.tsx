import { useState } from "react"
import { createRoot } from "react-dom/client"
import { CheckoutMethodPicker } from "../src/CheckoutMethodPicker.js"
import { PricingTable } from "../src/PricingTable.js"
import { formatPrice, type PricingAllocation, type PricingPlan } from "../src/plans.js"
import { METHODS, PLANS, STAFF_PLAN, UNIT_LABELS } from "./catalogue.js"
import "./styles.css"

function formatUnit(allocation: PricingAllocation): string {
  const forms = UNIT_LABELS[allocation.unit]
  if (!forms) return `${allocation.amount.toLocaleString("fr-FR")} ${allocation.unit}`
  const [one, many] = forms
  return `${allocation.amount.toLocaleString("fr-FR")} ${allocation.amount > 1 ? many : one}`
}

type Screen = "pricing" | "methods"

function App() {
  const [screen, setScreen] = useState<Screen>("pricing")
  const [layout, setLayout] = useState<"cards" | "table">("cards")
  const [authenticated, setAuthenticated] = useState(true)
  const [busy, setBusy] = useState(false)
  const [empty, setEmpty] = useState(false)
  const [leakStaff, setLeakStaff] = useState(false)
  const [current, setCurrent] = useState<string | undefined>(undefined)
  const [log, setLog] = useState<string[]>([])

  const record = (line: string) => setLog((l) => [line, ...l].slice(0, 6))

  const plans = empty ? [] : leakStaff ? [...PLANS, STAFF_PLAN] : PLANS

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-6 py-4">
          <h1 className="mr-4 text-sm font-semibold">lungor-sdk-react</h1>
          <Tab active={screen === "pricing"} onClick={() => setScreen("pricing")}>
            PricingTable
          </Tab>
          <Tab active={screen === "methods"} onClick={() => setScreen("methods")}>
            CheckoutMethodPicker
          </Tab>
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl flex-wrap gap-4 px-6 py-4 text-sm">
        {screen === "pricing" && (
          <>
            <Toggle checked={layout === "table"} onChange={(v) => setLayout(v ? "table" : "cards")}>
              Comparatif
            </Toggle>
            <Toggle checked={authenticated} onChange={setAuthenticated}>
              Connecté
            </Toggle>
            <Toggle checked={current === "solo"} onChange={(v) => setCurrent(v ? "solo" : undefined)}>
              Abonné Solo
            </Toggle>
            <Toggle checked={empty} onChange={setEmpty}>
              Catalogue vide
            </Toggle>
            <Toggle checked={leakStaff} onChange={setLeakStaff}>
              Fuite d’un plan staff
            </Toggle>
          </>
        )}
        <Toggle checked={busy} onChange={setBusy}>
          Occupé
        </Toggle>
      </div>

      {leakStaff && screen === "pricing" && (
        <div className="mx-auto max-w-5xl px-6 pb-2">
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
            Le plan « Staff » ci-dessous ne doit jamais atteindre une page tarifaire. Lungor le
            retient à la source ; s’il s’affiche ici, la route catalogue l’a laissé passer.
          </p>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-6 py-6">
        {screen === "pricing" ? (
          <PricingTable
            plans={plans}
            layout={layout}
            authenticated={authenticated}
            currentPlanCode={current}
            busy={busy}
            locale="fr-FR"
            formatUnit={formatUnit}
            heading="Nos offres"
            description="Une source traitée compte pour une synthèse."
            onSelect={(plan: PricingPlan, intent) =>
              record(`${intent} → ${plan.code} (${formatPrice(plan.amount, plan.currency, "fr-FR")})`)
            }
          />
        ) : (
          <CheckoutMethodPicker
            methods={METHODS}
            busy={busy}
            amountLabel={formatPrice(2900, "EUR", "fr-FR")}
            onSelect={(id) => record(`payment_method → ${id}`)}
          />
        )}
      </main>

      <footer className="mx-auto max-w-5xl px-6 pb-10">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Ce que le composant renvoie
        </h2>
        <ul className="space-y-1 font-mono text-xs text-muted-foreground">
          {log.length === 0 ? <li>—</li> : log.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      </footer>
    </div>
  )
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
        active ? "bg-foreground text-background" : "border border-input hover:bg-muted"
      }`}
    >
      {children}
    </button>
  )
}

function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: React.ReactNode
}) {
  return (
    <label className="inline-flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  )
}

createRoot(document.getElementById("root")!).render(<App />)
