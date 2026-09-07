import type { CheckoutMethod } from "../src/methods.js"
import type { PricingPlan } from "../src/plans.js"

export const PLANS: PricingPlan[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    code: "free",
    name: "Découverte",
    description: "Pour essayer Synthiz sans engagement.",
    amount: 0,
    currency: "EUR",
    interval: "month",
    intervalCount: 1,
    allocations: [{ unit: "synthesis", amount: 5 }],
    features: ["Toutes les sources", "Historique 30 jours"],
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    code: "solo",
    name: "Solo",
    description: "Pour une veille personnelle régulière.",
    amount: 1200,
    currency: "EUR",
    interval: "month",
    intervalCount: 1,
    allocations: [{ unit: "synthesis", amount: 50 }],
    features: ["Historique illimité", "Export PDF"],
    highlighted: true,
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    code: "pro",
    name: "Pro",
    description: "Pour les indépendants qui synthétisent chaque jour.",
    amount: 2900,
    currency: "EUR",
    interval: "month",
    intervalCount: 1,
    allocations: [{ unit: "synthesis", amount: 200 }],
    features: ["Historique illimité", "Export PDF", "Support prioritaire"],
  },
  {
    id: "44444444-4444-4444-4444-444444444444",
    code: "enterprise",
    name: "Entreprise",
    description: "Pour les équipes qui ont besoin de SSO et d’un contrat.",
    amount: 0,
    currency: "EUR",
    interval: "month",
    intervalCount: 1,
    purchasable: false,
    priceLabel: "Sur devis",
    features: ["Facturation annuelle", "SSO"],
  },
]

// What a catalogue route must never hand a pricing page. Kept here so the
// playground can show, side by side, a grid served the plans a caller should
// get and the same grid served a staff tier by mistake.
export const STAFF_PLAN: PricingPlan = {
  id: "55555555-5555-5555-5555-555555555555",
  code: "staff",
  name: "Staff",
  amount: 0,
  currency: "EUR",
  interval: "month",
  intervalCount: 1,
  purchasable: false,
  allocations: [{ unit: "synthesis", amount: 100000 }],
  features: ["Attribué par grant", "Jamais en vente"],
}

export const METHODS: CheckoutMethod[] = [
  { id: "card", label: "Carte bancaire" },
  { id: "apple_pay", label: "Apple Pay" },
  { id: "paypal", label: "PayPal" },
  { id: "bank_transfer", label: "Virement bancaire" },
]

export const UNIT_LABELS: Record<string, [string, string]> = {
  synthesis: ["synthèse", "synthèses"],
}
