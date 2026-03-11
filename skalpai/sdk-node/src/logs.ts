import type { Logger } from '@opentelemetry/api-logs';
import { SeverityNumber } from '@opentelemetry/api-logs';

const original = {
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

let patched = false;

function serialize(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function emit(
  logger: Logger,
  severityText: string,
  severityNumber: SeverityNumber,
  args: unknown[],
): void {
  const body = args.map(serialize).join(' ');
  logger.emit({ severityText, severityNumber, body });
}

export function patchConsole(logger: Logger): void {
  if (patched) return;

  console.debug = (...args: unknown[]) => {
    original.debug(...args);
    emit(logger, 'DEBUG', SeverityNumber.DEBUG, args);
  };
  console.info = (...args: unknown[]) => {
    original.info(...args);
    emit(logger, 'INFO', SeverityNumber.INFO, args);
  };
  console.log = (...args: unknown[]) => {
    original.log(...args);
    emit(logger, 'INFO', SeverityNumber.INFO, args);
  };
  console.warn = (...args: unknown[]) => {
    original.warn(...args);
    emit(logger, 'WARN', SeverityNumber.WARN, args);
  };
  console.error = (...args: unknown[]) => {
    original.error(...args);
    emit(logger, 'ERROR', SeverityNumber.ERROR, args);
  };

  patched = true;
}
