import { metrics } from '@opentelemetry/api';
import type { Attributes } from '@opentelemetry/api';
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface HTTPMiddlewareConfig {
  serviceName?: string;
  routeExtractor?: (req: IncomingMessage) => string | undefined;
}

export type NodeHTTPRequestHandler<TReq extends IncomingMessage = IncomingMessage, TRes extends ServerResponse = ServerResponse> =
  (req: TReq, res: TRes) => void | Promise<void>;

type HTTPInstruments = {
  requestCount: ReturnType<ReturnType<typeof metrics.getMeter>['createCounter']>;
  requestDuration: ReturnType<ReturnType<typeof metrics.getMeter>['createHistogram']>;
  activeRequests: ReturnType<ReturnType<typeof metrics.getMeter>['createUpDownCounter']>;
  responseSize: ReturnType<ReturnType<typeof metrics.getMeter>['createHistogram']>;
};

const instrumentsByService = new Map<string, HTTPInstruments>();

export function wrapHttpHandler<TReq extends IncomingMessage, TRes extends ServerResponse>(
  handler: NodeHTTPRequestHandler<TReq, TRes>,
  config: HTTPMiddlewareConfig = {},
): NodeHTTPRequestHandler<TReq, TRes> {
  const serviceName = resolveServiceName(config.serviceName);
  const instruments = getInstruments(serviceName);

  return (req, res) => {
    const start = process.hrtime.bigint();
    const baseAttributes = requestAttributes(req, config.routeExtractor);
    let bytesWritten = 0;
    let settled = false;

    instruments.activeRequests.add(1, baseAttributes);

    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    res.write = ((chunk: unknown, ...args: unknown[]) => {
      bytesWritten += byteLength(chunk, toEncoding(args[0]));
      return originalWrite(chunk as never, ...(args as never[]));
    }) as typeof res.write;

    res.end = ((chunk?: unknown, ...args: unknown[]) => {
      if (chunk !== undefined) {
        bytesWritten += byteLength(chunk, toEncoding(args[0]));
      }
      return originalEnd(chunk as never, ...(args as never[]));
    }) as typeof res.end;

    const finalize = () => {
      if (settled) return;
      settled = true;

      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      const finalAttributes = requestAttributes(req, config.routeExtractor, res.statusCode);

      instruments.activeRequests.add(-1, baseAttributes);
      instruments.requestCount.add(1, finalAttributes);
      instruments.requestDuration.record(durationSeconds, finalAttributes);
      instruments.responseSize.record(bytesWritten, finalAttributes);
    };

    res.once('finish', finalize);
    res.once('close', finalize);

    return handler(req, res);
  };
}

function getInstruments(serviceName: string): HTTPInstruments {
  const existing = instrumentsByService.get(serviceName);
  if (existing) return existing;

  const meter = metrics.getMeter(serviceName);
  const instruments: HTTPInstruments = {
    requestCount: meter.createCounter('http.server.request.count', {
      description: 'Total number of HTTP server requests.',
      unit: '{request}',
    }),
    requestDuration: meter.createHistogram('http.server.request.duration', {
      description: 'Total HTTP server request duration in seconds.',
      unit: 's',
    }),
    activeRequests: meter.createUpDownCounter('http.server.active_requests', {
      description: 'Current number of in-flight HTTP server requests.',
      unit: '{request}',
    }),
    responseSize: meter.createHistogram('http.server.response.size', {
      description: 'HTTP response size in bytes.',
      unit: 'By',
    }),
  };
  instrumentsByService.set(serviceName, instruments);
  return instruments;
}

function requestAttributes(
  req: IncomingMessage,
  routeExtractor?: (req: IncomingMessage) => string | undefined,
  statusCode?: number,
): Attributes {
  const attributes: Attributes = {
    'http.request.method': req.method ?? 'GET',
    'server.address': req.headers.host ?? '',
  };

  const route = routeExtractor?.(req);
  if (route) {
    attributes['http.route'] = route;
  }
  if (statusCode && statusCode > 0) {
    attributes['http.response.status_code'] = statusCode;
    attributes['http.response.status_class'] = `${Math.floor(statusCode / 100)}xx`;
  }

  return attributes;
}

function resolveServiceName(serviceName?: string) {
  return serviceName
    || process.env.SKALPAI_SERVICE
    || process.env.OTEL_SERVICE_NAME
    || process.env.npm_package_name
    || 'unknown';
}

function byteLength(chunk: unknown, encoding?: BufferEncoding) {
  if (typeof chunk === 'string') {
    return Buffer.byteLength(chunk, encoding);
  }
  if (Buffer.isBuffer(chunk)) {
    return chunk.length;
  }
  if (chunk instanceof Uint8Array) {
    return chunk.byteLength;
  }
  return 0;
}

function toEncoding(value: unknown): BufferEncoding | undefined {
  return typeof value === 'string' ? value as BufferEncoding : undefined;
}
