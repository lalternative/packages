import type { Logger } from '@opentelemetry/api-logs';
import { SeverityNumber } from '@opentelemetry/api-logs';

/** Capture global errors and unhandled rejections as OTEL log records. */
export function captureGlobalErrors(logger: Logger): () => void {
  const onError = (event: ErrorEvent) => {
    logger.emit({
      severityText: 'ERROR',
      severityNumber: SeverityNumber.ERROR,
      body: event.message,
      attributes: {
        'error.type': event.error?.name ?? 'Error',
        'error.stack': event.error?.stack ?? '',
        'error.filename': event.filename ?? '',
        'error.lineno': event.lineno ?? 0,
        'error.colno': event.colno ?? 0,
        'browser.url': location.href,
      },
    });
  };

  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack ?? '' : '';
    logger.emit({
      severityText: 'ERROR',
      severityNumber: SeverityNumber.ERROR,
      body: `Unhandled rejection: ${message}`,
      attributes: {
        'error.type': reason?.constructor?.name ?? 'UnhandledRejection',
        'error.stack': stack,
        'browser.url': location.href,
      },
    });
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
