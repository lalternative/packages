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

const EXPORTER_TIMEOUT_MS = 10_000;
const LOG_BATCH_DELAY_MS = 30_000;
const LOG_MAX_QUEUE_SIZE = 256;
const LOG_MAX_BATCH_SIZE = 32;
const SPAN_BATCH_DELAY_MS = 30_000;
const SPAN_MAX_QUEUE_SIZE = 256;
const SPAN_MAX_BATCH_SIZE = 32;
const DEFAULT_METRICS_INTERVAL_MS = 60_000;
const METRICS_EXPORT_TIMEOUT_MS = 30_000;

export interface SkalpaiConfig {
  endpoint: string;
  apiKey?: string;
  serviceName?: string;
  serviceVersion?: string;
  environment?: string;
  /** Metrics export interval in ms (default: 60000) */
  metricsInterval?: number;
  /** Disable console patching for log capture (default: false) */
  disableConsoleLogs?: boolean;
  /** Minimum captured console level (default: "warn") */
  logLevel?: BrowserLogLevel;
  /** Disable metrics collection (default: true) */
  disableMetrics?: boolean;
}

let tracerProvider: BasicTracerProvider | null = null;
let loggerProvider: LoggerProvider | null = null;
let meterProvider: MeterProvider | null = null;
let cleanupErrors: (() => void) | null = null;
let cleanupMetrics: (() => void) | null = null;
let initialized = false;

export function init(config: SkalpaiConfig): void {
  if (initialized) {
    console.warn('[skalpai] already initialized');
    return;
  }

  const {
    endpoint,
    apiKey,
    serviceName = 'unknown',
    serviceVersion = '0.0.0',
    environment = 'production',
    metricsInterval = DEFAULT_METRICS_INTERVAL_MS,
    disableConsoleLogs = false,
    logLevel = 'warn',
    disableMetrics = true,
  } = config;

  const headers = apiKey ? { 'x-api-key': apiKey } : undefined;

  const resource = resourceFromAttributes({
    'service.name': serviceName,
    'service.version': serviceVersion,
    'deployment.environment': environment,
    'telemetry.sdk.language': 'webjs',
    'telemetry.sdk.name': '@skalpai/sdk-browser',
  });

  // Traces
  const traceExporter = new OTLPTraceExporter({
    url: `${endpoint}/v1/traces`,
    headers,
    timeoutMillis: EXPORTER_TIMEOUT_MS,
  });
  tracerProvider = new BasicTracerProvider({
    resource,
    spanProcessors: [
      new BatchSpanProcessor(traceExporter, {
        scheduledDelayMillis: SPAN_BATCH_DELAY_MS,
        maxQueueSize: SPAN_MAX_QUEUE_SIZE,
        maxExportBatchSize: SPAN_MAX_BATCH_SIZE,
        exportTimeoutMillis: EXPORTER_TIMEOUT_MS,
      }),
    ],
  });

  // Logs
  const logExporter = new OTLPLogExporter({
    url: `${endpoint}/v1/logs`,
    headers,
    timeoutMillis: EXPORTER_TIMEOUT_MS,
  });
  loggerProvider = new LoggerProvider({
    resource,
    processors: [
      new BatchLogRecordProcessor(logExporter, {
        scheduledDelayMillis: LOG_BATCH_DELAY_MS,
        maxQueueSize: LOG_MAX_QUEUE_SIZE,
        maxExportBatchSize: LOG_MAX_BATCH_SIZE,
        exportTimeoutMillis: EXPORTER_TIMEOUT_MS,
      }),
    ],
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
      timeoutMillis: EXPORTER_TIMEOUT_MS,
    });
    meterProvider = new MeterProvider({
      resource,
      readers: [
        new PeriodicExportingMetricReader({
          exporter: metricExporter,
          exportIntervalMillis: metricsInterval,
          exportTimeoutMillis: METRICS_EXPORT_TIMEOUT_MS,
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
  console.log(`[skalpai] initialized — service=${serviceName} endpoint=${endpoint}`);
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
