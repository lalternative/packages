/**
 * The query parameter Lungor stamps on both return URLs at checkout, carrying
 * the session id. The provider's redirect says nothing about the outcome —
 * Mollie sends the payer back to the same URL paid or refused — so the page
 * they land on reads this and asks.
 */
export const CHECKOUT_SESSION_PARAM = 'lungor_session_id';

/**
 * Where a checkout session stands, as `GET /finance/checkout/{session_id}`
 * reports it. `pending` and `redirected` are still in flight; the four others
 * are final.
 */
export type CheckoutStatus =
  | 'pending'
  | 'redirected'
  | 'completed'
  | 'failed'
  | 'canceled'
  | 'expired';

export interface CheckoutSession {
  sessionId: string;
  status: CheckoutStatus;
  /** The one field to open access on: true once the provider settled the payment. */
  paid: boolean;
  /** The provider's own word for a refusal (`insufficient_funds`…). Set on `failed` only. */
  failureReason?: string;
  subscriptionId?: string;
  subscriptionStatus?: string;
}

export function isFinalCheckoutStatus(status: CheckoutStatus): boolean {
  return status !== 'pending' && status !== 'redirected';
}

/**
 * The session id the current page was returned with, or undefined off a
 * checkout return. Guarded for SSR, where the first render has no window and
 * the outcome simply appears on hydration.
 */
export function readCheckoutSessionId(search?: string): string | undefined {
  const raw = search ?? (typeof window === 'undefined' ? '' : window.location.search);
  if (!raw) return undefined;
  return new URLSearchParams(raw).get(CHECKOUT_SESSION_PARAM) ?? undefined;
}
