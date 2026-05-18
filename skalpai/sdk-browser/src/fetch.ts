import type { Tracer } from '@opentelemetry/api';
import { SpanStatusCode, context, propagation, trace } from '@opentelemetry/api';

export interface FetchInstrumentationOptions {
  endpoint: string;
  propagateTo: (string | RegExp)[];
  redactQuery: boolean;
  ignoreUrls: (string | RegExp)[];
}

function matchesAny(value: string, host: string, patterns: (string | RegExp)[]): boolean {
  for (const pattern of patterns) {
    if (typeof pattern === 'string') {
      if (host.includes(pattern)) return true;
    } else if (pattern.test(value)) {
      return true;
    }
  }
  return false;
}

function redactQueryString(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.search) return rawUrl;
    const redacted = new URLSearchParams();
    for (const key of parsed.searchParams.keys()) {
      redacted.append(key, 'REDACTED');
    }
    parsed.search = redacted.toString();
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function resolveRequest(input: RequestInfo | URL, init?: RequestInit): {
  url: string;
  method: string;
} {
  let url: string;
  let method = 'GET';
  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else {
    url = input.url;
    method = input.method || 'GET';
  }
  if (init?.method) method = init.method;
  return { url: absoluteUrl(url), method: method.toUpperCase() };
}

function absoluteUrl(url: string): string {
  try {
    return new URL(url, location.href).toString();
  } catch {
    return url;
  }
}

function isSelfTelemetry(targetUrl: string, endpoint: string): boolean {
  try {
    const target = new URL(targetUrl);
    const self = new URL(endpoint);
    if (target.host !== self.host) return false;
    const selfPath = self.pathname.replace(/\/$/, '');
    return target.pathname.startsWith(selfPath);
  } catch {
    return false;
  }
}

/** Monkey-patch window.fetch to emit spans and inject W3C traceparent on allowlisted hosts. */
export function instrumentFetch(
  tracer: Tracer,
  opts: FetchInstrumentationOptions,
): () => void {
  const originalFetch = window.fetch.bind(window);

  const wrapped: typeof window.fetch = async (input, init) => {
    const { url, method } = resolveRequest(input, init);

    if (isSelfTelemetry(url, opts.endpoint)) {
      return originalFetch(input, init);
    }

    let host = '';
    try {
      host = new URL(url).host;
    } catch {
      // keep host empty
    }

    if (opts.ignoreUrls.length > 0 && matchesAny(url, host, opts.ignoreUrls)) {
      return originalFetch(input, init);
    }

    const displayUrl = opts.redactQuery ? redactQueryString(url) : url;

    const span = tracer.startSpan(`HTTP ${method}`, {
      attributes: {
        'http.request.method': method,
        'url.full': displayUrl,
        'server.address': host,
      },
    });

    const shouldPropagate =
      opts.propagateTo.length > 0 && matchesAny(url, host, opts.propagateTo);

    // Activate the fetch span in the current context so propagation.inject
    // emits a traceparent that carries this span's trace_id/span_id rather
    // than the parent context's ids.
    const ctxWithSpan = trace.setSpan(context.active(), span);

    let finalInit: RequestInit | undefined = init;
    let finalInput: RequestInfo | URL = input;

    if (shouldPropagate) {
      const carrier: Record<string, string> = {};
      propagation.inject(ctxWithSpan, carrier);

      const existingHeaders = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      );
      for (const [k, v] of Object.entries(carrier)) {
        existingHeaders.set(k, v);
      }

      if (input instanceof Request) {
        finalInput = new Request(input, { headers: existingHeaders });
        finalInit = init;
      } else {
        finalInit = { ...(init ?? {}), headers: existingHeaders };
      }
    }

    return context.with(ctxWithSpan, async () => {
      try {
        const response = await originalFetch(finalInput, finalInit);
        span.setAttribute('http.response.status_code', response.status);
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          const size = Number(contentLength);
          if (!Number.isNaN(size)) {
            span.setAttribute('http.response.body.size', size);
          }
        }
        if (response.status >= 400) {
          span.setStatus({ code: SpanStatusCode.ERROR });
        }
        return response;
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        span.end();
      }
    });
  };

  window.fetch = wrapped;

  return () => {
    if (window.fetch === wrapped) {
      window.fetch = originalFetch;
    }
  };
}
