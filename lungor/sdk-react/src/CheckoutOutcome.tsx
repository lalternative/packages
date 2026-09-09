import {
  useCheckoutReturn,
  type CheckoutReturnPhase,
  type UseCheckoutReturnOptions,
} from './useCheckoutReturn.js';
import type { CheckoutSession } from './checkout.js';

export interface CheckoutOutcomeLabels {
  checking?: string;
  completed?: string;
  completedDetail?: string;
  failed?: string;
  failedDetail?: string;
  canceled?: string;
  canceledDetail?: string;
  expired?: string;
  expiredDetail?: string;
  timeout?: string;
  timeoutDetail?: string;
  error?: string;
  errorDetail?: string;
  continueCta?: string;
  retryCta?: string;
  refreshCta?: string;
  dismissCta?: string;
}

const DEFAULT_LABELS: Required<CheckoutOutcomeLabels> = {
  checking: 'Vérification du paiement…',
  completed: 'Paiement confirmé',
  completedDetail: 'Votre offre est active.',
  failed: 'Paiement refusé',
  failedDetail: 'Votre banque n’a pas accepté le paiement. Aucun montant n’a été prélevé.',
  canceled: 'Paiement annulé',
  canceledDetail: 'Vous avez quitté la page de paiement. Aucun montant n’a été prélevé.',
  expired: 'Session expirée',
  expiredDetail: 'La page de paiement a expiré avant d’être validée. Aucun montant n’a été prélevé.',
  timeout: 'Confirmation en attente',
  timeoutDetail:
    'Le paiement a été transmis mais sa confirmation tarde. Elle arrivera d’elle-même ; vous pouvez actualiser d’ici là.',
  error: 'Vérification impossible',
  errorDetail: 'Nous n’avons pas pu lire l’état du paiement. Réessayez dans un instant.',
  continueCta: 'Continuer',
  retryCta: 'Réessayer le paiement',
  refreshCta: 'Actualiser',
  dismissCta: 'Plus tard',
};

/** The provider's reasons a shopper can act on. Anything else falls back to `failedDetail`. */
const FAILURE_DETAILS: Record<string, string> = {
  insufficient_funds: 'Le solde de la carte est insuffisant. Essayez une autre carte.',
  invalid_card_number: 'Le numéro de carte est invalide.',
  invalid_cvv: 'Le cryptogramme est invalide.',
  invalid_card_holder_name: 'Le nom du titulaire est invalide.',
  card_expired: 'La carte est expirée.',
  card_declined: 'La carte a été refusée par votre banque.',
  refused_by_issuer: 'La carte a été refusée par votre banque.',
  authentication_failed: 'L’authentification 3-D Secure a échoué.',
  possible_fraud: 'Le paiement a été bloqué par votre banque. Contactez-la ou essayez une autre carte.',
};

export interface CheckoutOutcomeProps extends UseCheckoutReturnOptions {
  /** Pressed on a confirmed payment. Typically strips the session id from the URL and moves on. */
  onContinue?: (session: CheckoutSession) => void;
  /**
   * Pressed after a refusal, a cancellation or an expiry. On the plans page
   * itself, scroll to the grid; elsewhere, navigate to it.
   */
  onRetry?: (session: CheckoutSession) => void;
  /** Pressed to leave an unpaid ending alone. Typically strips the session id from the URL. */
  onDismiss?: (session: CheckoutSession) => void;
  /**
   * `banner` fits inside a page; `hero` heads the plans page the checkout
   * returns to, where the outcome is the whole reason the page is open.
   */
  variant?: 'banner' | 'hero';
  labels?: CheckoutOutcomeLabels;
  className?: string;
}

type Tone = 'neutral' | 'success' | 'failure';

function Icon({ phase, tone }: { phase: CheckoutReturnPhase; tone: Tone }) {
  if (phase === 'checking') {
    return (
      <span
        aria-hidden="true"
        className="size-5 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-foreground"
      />
    );
  }
  const stroke =
    tone === 'success' ? 'text-primary' : tone === 'failure' ? 'text-destructive' : 'text-muted-foreground';
  const path =
    tone === 'success'
      ? 'M9 12l2 2 4-4'
      : tone === 'failure'
        ? 'M15 9l-6 6M9 9l6 6'
        : 'M12 7v5l3 2';
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`size-5 shrink-0 ${stroke}`}
    >
      <circle cx="12" cy="12" r="9" />
      <path d={path} />
    </svg>
  );
}

/**
 * Tells the payer how the checkout they just returned from ended.
 *
 * Renders nothing off a checkout return, so it can sit permanently on the
 * page Lungor redirects to. Styling is Tailwind on the shadcn design tokens,
 * like the other components, so it inherits the host app's theme.
 */
export function CheckoutOutcome({
  onContinue,
  onRetry,
  onDismiss,
  variant = 'banner',
  labels,
  className = '',
  ...options
}: CheckoutOutcomeProps) {
  const state = useCheckoutReturn(options);
  const l = { ...DEFAULT_LABELS, ...labels };
  const { phase, session } = state;

  if (phase === 'idle') return null;

  const tone: Tone =
    phase === 'completed'
      ? 'success'
      : phase === 'checking' || phase === 'timeout'
        ? 'neutral'
        : 'failure';

  let title = l.checking;
  let detail: string | undefined;
  let primary: { label: string; run: () => void } | undefined;
  let secondary: { label: string; run: () => void } | undefined;
  const unpaid = () => {
    if (onRetry && session) primary = { label: l.retryCta, run: () => onRetry(session) };
    if (onDismiss && session) secondary = { label: l.dismissCta, run: () => onDismiss(session) };
  };
  // A payer who has understood that a transfer settles in days must be able
  // to leave the page cleanly; the same holds when the read itself failed.
  const inFlight: CheckoutSession = session ?? {
    sessionId: state.sessionId ?? '',
    status: 'redirected',
    paid: false,
  };
  const leaveLater = () => {
    if (onDismiss) secondary = { label: l.dismissCta, run: () => onDismiss(inFlight) };
  };

  switch (phase) {
    case 'completed':
      title = l.completed;
      detail = l.completedDetail;
      if (onContinue && session) primary = { label: l.continueCta, run: () => onContinue(session) };
      break;
    case 'failed':
      title = l.failed;
      detail = (session?.failureReason && FAILURE_DETAILS[session.failureReason]) || l.failedDetail;
      unpaid();
      break;
    case 'canceled':
      title = l.canceled;
      detail = l.canceledDetail;
      unpaid();
      break;
    case 'expired':
      title = l.expired;
      detail = l.expiredDetail;
      unpaid();
      break;
    case 'timeout':
      title = l.timeout;
      detail = l.timeoutDetail;
      primary = { label: l.refreshCta, run: state.retry };
      leaveLater();
      break;
    case 'error':
      title = l.error;
      detail = l.errorDetail;
      primary = { label: l.refreshCta, run: state.retry };
      leaveLater();
      break;
  }

  const surface =
    tone === 'success'
      ? 'border-primary/30 bg-primary/5'
      : tone === 'failure'
        ? 'border-destructive/30 bg-destructive/5'
        : 'border-border bg-muted/30';

  const primaryButton = primary ? (
    <button
      type="button"
      onClick={primary.run}
      className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {primary.label}
    </button>
  ) : null;
  const secondaryButton = secondary ? (
    <button
      type="button"
      onClick={secondary.run}
      className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {secondary.label}
    </button>
  ) : null;

  if (variant === 'hero') {
    return (
      <section
        role="status"
        aria-live="polite"
        className={`flex flex-col items-center gap-4 rounded-xl border px-6 py-10 text-center ${surface} ${className}`.trim()}
      >
        <span
          className={`flex size-12 items-center justify-center rounded-full ${
            tone === 'success'
              ? 'bg-primary/10'
              : tone === 'failure'
                ? 'bg-destructive/10'
                : 'bg-muted'
          } [&>*]:size-6`}
        >
          <Icon phase={phase} tone={tone} />
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
          {detail ? <p className="max-w-md text-sm text-muted-foreground">{detail}</p> : null}
        </div>
        {primaryButton || secondaryButton ? (
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {primaryButton}
            {secondaryButton}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 rounded-lg border p-4 ${surface} ${className}`.trim()}
    >
      <span className="mt-0.5">
        <Icon phase={phase} tone={tone} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          {detail ? <p className="mt-0.5 text-sm text-muted-foreground">{detail}</p> : null}
        </div>
        {primaryButton || secondaryButton ? (
          <div className="flex flex-wrap items-center gap-2">
            {primaryButton}
            {secondaryButton}
          </div>
        ) : null}
      </div>
    </div>
  );
}
