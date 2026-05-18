import type { Logger } from '@opentelemetry/api-logs';
import { SeverityNumber } from '@opentelemetry/api-logs';

type NavigationType = 'initial' | 'push' | 'replace' | 'popstate' | 'hashchange';

const SESSION_STORAGE_KEY = 'skalpai.session.id';

function getOrCreateSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    sessionStorage.setItem(SESSION_STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

/** Track SPA pageviews (initial load + History API + popstate/hashchange) as OTEL log records. */
export function startPageviewTracking(logger: Logger): () => void {
  const sessionId = getOrCreateSessionId();
  let previousUrl = location.href;

  const emit = (navigationType: NavigationType, referrer: string) => {
    logger.emit({
      severityText: 'INFO',
      severityNumber: SeverityNumber.INFO,
      body: 'pageview',
      attributes: {
        'page.url': location.href,
        'page.path': location.pathname,
        'page.search': location.search,
        'page.hash': location.hash,
        'page.title': document.title,
        'page.referrer': referrer,
        'session.id': sessionId,
        'navigation.type': navigationType,
      },
    });
  };

  const handleChange = (navigationType: NavigationType) => {
    const currentUrl = location.href;
    if (currentUrl === previousUrl) return;
    const referrer = previousUrl;
    previousUrl = currentUrl;
    emit(navigationType, referrer);
  };

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function patchedPushState(
    this: History,
    ...args: Parameters<typeof history.pushState>
  ): void {
    originalPushState.apply(this, args);
    handleChange('push');
  };

  history.replaceState = function patchedReplaceState(
    this: History,
    ...args: Parameters<typeof history.replaceState>
  ): void {
    originalReplaceState.apply(this, args);
    handleChange('replace');
  };

  const onPopState = () => handleChange('popstate');
  const onHashChange = () => handleChange('hashchange');

  window.addEventListener('popstate', onPopState);
  window.addEventListener('hashchange', onHashChange);

  // Initial pageview
  emit('initial', document.referrer);

  return () => {
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    window.removeEventListener('popstate', onPopState);
    window.removeEventListener('hashchange', onHashChange);
  };
}
