import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { logs } from '@opentelemetry/api-logs';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';

import { patchConsole } from './logs.js';
import { startRuntimeMetrics } from './metrics.js';

export interface SkalpelConfig {
  endpoint: string;
  apiKey: string;
  serviceName?: string;
  serviceVersion?: string;
  environment?: string;
  /** Metrics export interval in ms (default: 15000) */
  metricsInterval?: number;
  /** Disable console patching for log capture (default: false) */
  disableConsoleLogs?: boolean;
  /** Disable runtime metrics collection (default: false) */
  disableMetrics?: boolean;
}

let sdk: NodeSDK | null = null;
let loggerProvider: LoggerProvider | null = null;
let meterProvider: MeterProvider | null = null;
let metricsCleanup: (() => void) | null = null;

export function init(config: SkalpelConfig): void {
  if (sdk) {
    console.warn('[skalpel] already initialized');
    return;
  }

  const {
    endpoint,
    apiKey,
    serviceName = 'unknown',
    serviceVersion = '0.0.0',
    environment = process.env.NODE_ENV || 'development',
    metricsInterval = 15_000,
    disableConsoleLogs = false,
    disableMetrics = false,
  } = config;

  const headers = { 'x-api-key': apiKey };

  const resource = resourceFromAttributes({
    'service.name': serviceName,
    'service.version': serviceVersion,
    'deployment.environment': environment,
  });

  // Traces
  const traceExporter = new OTLPTraceExporter({
    url: `${endpoint}/v1/traces`,
    headers,
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

  if (!disableConsoleLogs) {
    const logger = logs.getLogger(serviceName, serviceVersion);
    patchConsole(logger);
  }

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
    metricsCleanup = startRuntimeMetrics(meterProvider, serviceName);
  }

  // SDK (traces)
  sdk = new NodeSDK({
    resource,
    spanProcessors: [new BatchSpanProcessor(traceExporter)],
  });
  sdk.start();

  // Graceful shutdown
  const onSignal = () => shutdown().then(() => process.exit(0));
  process.on('SIGTERM', onSignal);
  process.on('SIGINT', onSignal);

  console.log(`[skalpel] initialized — service=${serviceName} endpoint=${endpoint}`);
}

export async function shutdown(): Promise<void> {
  metricsCleanup?.();
  await Promise.all([
    sdk?.shutdown(),
    loggerProvider?.shutdown(),
    meterProvider?.shutdown(),
  ]);
  sdk = null;
  loggerProvider = null;
  meterProvider = null;
  metricsCleanup = null;
}
