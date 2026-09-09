import { useEffect, useRef, useState } from 'react';
import {
  isFinalCheckoutStatus,
  readCheckoutSessionId,
  type CheckoutSession,
  type CheckoutStatus,
} from './checkout.js';

/**
 * What the return page shows. The four final statuses come straight from
 * Lungor; `checking` covers both in-flight ones, `timeout` is a checkout still
 * in flight after `timeoutMs`, and `error` is a fetch that failed.
 */
export type CheckoutReturnPhase =
  | 'idle'
  | 'checking'
  | 'completed'
  | 'failed'
  | 'canceled'
  | 'expired'
  | 'timeout'
  | 'error';

export interface UseCheckoutReturnOptions {
  /**
   * Reads the session from YOUR backend, which proxies Lungor's
   * `GET /finance/checkout/{session_id}` — the app key that authorises it is
   * a server-to-server secret and must never reach the browser.
   */
  fetchSession: (sessionId: string) => Promise<CheckoutSession>;
  /** Overrides the id read from the URL, for a route that already parsed it. */
  sessionId?: string;
  /** Called once, the first time the session reads as paid. */
  onPaid?: (session: CheckoutSession) => void;
  /** How often to ask again while the checkout is in flight. Defaults to 2s. */
  pollIntervalMs?: number;
  /** How long to keep asking before giving up on a confirmation. Defaults to 60s. */
  timeoutMs?: number;
}

export interface CheckoutReturnState {
  sessionId?: string;
  phase: CheckoutReturnPhase;
  session?: CheckoutSession;
  error?: unknown;
  /** Asks again, after `timeout` or `error`. */
  retry: () => void;
}

function phaseFor(status: CheckoutStatus): CheckoutReturnPhase {
  return isFinalCheckoutStatus(status) ? (status as CheckoutReturnPhase) : 'checking';
}

/**
 * Follows a checkout the payer just returned from until Lungor says how it
 * ended.
 *
 * Polls while the status is in flight: the provider's notification can land a
 * few seconds after the payer does, and a page that read `redirected` as a
 * failure would refuse someone whose card was accepted. Open access on
 * `session.paid`, never on the redirect alone.
 */
export function useCheckoutReturn({
  fetchSession,
  sessionId: givenSessionId,
  onPaid,
  pollIntervalMs = 2000,
  timeoutMs = 60000,
}: UseCheckoutReturnOptions): CheckoutReturnState {
  const [sessionId, setSessionId] = useState<string | undefined>(givenSessionId);
  const [phase, setPhase] = useState<CheckoutReturnPhase>(givenSessionId ? 'checking' : 'idle');
  const [session, setSession] = useState<CheckoutSession | undefined>(undefined);
  const [error, setError] = useState<unknown>(undefined);
  const [attempt, setAttempt] = useState(0);

  const paidReported = useRef(false);
  const latest = useRef({ fetchSession, onPaid });
  latest.current = { fetchSession, onPaid };

  useEffect(() => {
    if (givenSessionId) {
      setSessionId(givenSessionId);
      return;
    }
    const fromUrl = readCheckoutSessionId();
    setSessionId(fromUrl);
    if (fromUrl) setPhase('checking');
  }, [givenSessionId]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    setPhase('checking');
    setError(undefined);

    const ask = async () => {
      let next: CheckoutSession;
      try {
        next = await latest.current.fetchSession(sessionId);
      } catch (err) {
        if (cancelled) return;
        setError(err);
        setPhase('error');
        return;
      }
      if (cancelled) return;
      setSession(next);
      if (next.paid && !paidReported.current) {
        paidReported.current = true;
        latest.current.onPaid?.(next);
      }
      const nextPhase = phaseFor(next.status);
      if (nextPhase !== 'checking') {
        setPhase(nextPhase);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        setPhase('timeout');
        return;
      }
      timer = setTimeout(ask, pollIntervalMs);
    };
    void ask();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, attempt, pollIntervalMs, timeoutMs]);

  return {
    sessionId,
    phase,
    session,
    error,
    retry: () => setAttempt((n) => n + 1),
  };
}
