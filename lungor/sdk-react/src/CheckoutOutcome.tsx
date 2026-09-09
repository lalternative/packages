import { useCheckoutReturn, type UseCheckoutReturnOptions } from './useCheckoutReturn.js';
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
  /** Pressed after a refusal, a cancellation or an expiry: open a new checkout. */
  onRetry?: (session: CheckoutSession) => void;
  labels?: CheckoutOutcomeLabels;
  className?: string;
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
  labels,
  className = '',
  ...options
}: CheckoutOutcomeProps) {
  const state = useCheckoutReturn(options);
  const l = { ...DEFAULT_LABELS, ...labels };
  const { phase, session } = state;

  if (phase === 'idle') return null;

  const tone =
    phase === 'completed'
      ? 'border-primary/40 bg-primary/5'
      : phase === 'checking' || phase === 'timeout'
        ? 'border-input bg-muted/40'
        : 'border-destructive/40 bg-destructive/10';

  let title = l.checking;
  let detail: string | undefined;
  let action: { label: string; run: () => void } | undefined;

  switch (phase) {
    case 'completed':
      title = l.completed;
      detail = l.completedDetail;
      if (onContinue && session) action = { label: l.continueCta, run: () => onContinue(session) };
      break;
    case 'failed':
      title = l.failed;
      detail = (session?.failureReason && FAILURE_DETAILS[session.failureReason]) || l.failedDetail;
      if (onRetry && session) action = { label: l.retryCta, run: () => onRetry(session) };
      break;
    case 'canceled':
      title = l.canceled;
      detail = l.canceledDetail;
      if (onRetry && session) action = { label: l.retryCta, run: () => onRetry(session) };
      break;
    case 'expired':
      title = l.expired;
      detail = l.expiredDetail;
      if (onRetry && session) action = { label: l.retryCta, run: () => onRetry(session) };
      break;
    case 'timeout':
      title = l.timeout;
      detail = l.timeoutDetail;
      action = { label: l.refreshCta, run: state.retry };
      break;
    case 'error':
      title = l.error;
      detail = l.errorDetail;
      action = { label: l.refreshCta, run: state.retry };
      break;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col gap-3 rounded-md border p-4 ${tone} ${className}`.trim()}
    >
      <div className="flex items-center gap-2">
        {phase === 'checking' ? (
          <span
            aria-hidden="true"
            className="size-4 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-foreground"
          />
        ) : null}
        <p className="text-sm font-medium text-foreground">{title}</p>
      </div>
      {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
      {action ? (
        <button
          type="button"
          onClick={action.run}
          className="h-9 w-fit rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
