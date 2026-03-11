import { logs } from '@opentelemetry/api-logs';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { BasicTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';

import { patchConsole } from './logs.js';
import type { BrowserLogLevel } from './logs.js';
import { captureGlobalErrors } from './errors.js';
import { startBrowserMetrics } from './metrics.js';

export interface SkalpelBrowserConfig {
  endpoint: string;
  apiKey?: string;
  serviceName?: string;
  serviceVersion?: string;
  environment?: string;
  /** Metrics export interval in ms (default: 15000) */
  metricsInterval?: number;
  /** Disable console patching for log capture (default: false) */
  disableConsoleLogs?: boolean;
  /** Minimum captured console level (default: "warn") */
  logLevel?: BrowserLogLevel;
  /** Disable metrics collection (default: false) */
  disableMetrics?: boolean;
}

let tracerProvider: BasicTracerProvider | null = null;
let loggerProvider: LoggerProvider | null = null;
let meterProvider: MeterProvider | null = null;
let cleanupErrors: (() => void) | null = null;
let cleanupMetrics: (() => void) | null = null;
let initialized = false;

export function init(config: SkalpelBrowserConfig): void {
  if (initialized) {
    console.warn('[skalpel] already initialized');
    return;
  }

  const {
    endpoint,
    apiKey,
    serviceName = 'unknown',
    serviceVersion = '0.0.0',
    environment = 'production',
    metricsInterval = 15_000,
    disableConsoleLogs = false,
    logLevel = 'warn',
    disableMetrics = false,
  } = config;

  const headers = apiKey ? { 'x-api-key': apiKey } : undefined;

  const resource = resourceFromAttributes({
    'service.name': serviceName,
    'service.version': serviceVersion,
    'deployment.environment': environment,
    'telemetry.sdk.language': 'webjs',
    'telemetry.sdk.name': '@skalpel/sdk-browser',
  });

  // Traces
  const traceExporter = new OTLPTraceExporter({
    url: `${endpoint}/v1/traces`,
    headers,
  });
  tracerProvider = new BasicTracerProvider({
    resource,
    spanProcessors: [new BatchSpanProcessor(traceExporter)],
  });

  // Logs
  const logExporter = new OTLPLogExporter({
    url: `${endpoint}/v1/logs`,
    headers,
  });
  loggerProvider = new LoggerProvider({
    resource,
    processors: [new BatchLogRecordProcessor(logExporter)],
  });
  logs.setGlobalLoggerProvider(loggerProvider);

  const logger = logs.getLogger(serviceName, serviceVersion);

  if (!disableConsoleLogs && logLevel !== 'off') {
    patchConsole(logger, logLevel);
  }

  // Global error capture
  cleanupErrors = captureGlobalErrors(logger);

  // Metrics
  if (!disableMetrics) {
    const metricExporter = new OTLPMetricExporter({
      url: `${endpoint}/v1/metrics`,
      headers,
    });
    meterProvider = new MeterProvider({
      resource,
      readers: [
        new PeriodicExportingMetricReader({
          exporter: metricExporter,
          exportIntervalMillis: metricsInterval,
        }),
      ],
    });
    cleanupMetrics = startBrowserMetrics(meterProvider, serviceName);
  }

  // Flush on page hide
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flush();
    }
  });
  window.addEventListener('pagehide', flush);

  initialized = true;
  console.log(`[skalpel] initialized — service=${serviceName} endpoint=${endpoint}`);
}

function flush(): void {
  tracerProvider?.forceFlush();
  loggerProvider?.forceFlush();
  meterProvider?.forceFlush();
}

export async function shutdown(): Promise<void> {
  cleanupErrors?.();
  cleanupMetrics?.();
  await Promise.all([
    tracerProvider?.shutdown(),
    loggerProvider?.shutdown(),
    meterProvider?.shutdown(),
  ]);
  tracerProvider = null;
  loggerProvider = null;
  meterProvider = null;
  cleanupErrors = null;
  cleanupMetrics = null;
  initialized = false;
}
