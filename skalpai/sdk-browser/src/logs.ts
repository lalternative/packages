import type { Logger } from '@opentelemetry/api-logs';
import { SeverityNumber } from '@opentelemetry/api-logs';

export type BrowserLogLevel = 'off' | 'error' | 'warn' | 'info' | 'debug';

const original = {
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

let patched = false;
const ANSI_ESCAPE_RE = /\u001b\[[0-9;]*m/g;
const FORMAT_TOKEN_RE = /%(%|[cdifoOs])/g;

function serialize(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function cleanText(value: string): string {
  return value
    .replace(ANSI_ESCAPE_RE, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim();
}

function formatConsoleArgs(args: unknown[]): string {
  if (args.length === 0) return '';

  const [first, ...rest] = args;
  if (typeof first !== 'string') {
    return cleanText(args.map(serialize).join(' '));
  }

  let restIndex = 0;
  const formatted = first.replace(FORMAT_TOKEN_RE, (match, token: string) => {
    if (token === '%') return '%';
    if (token === 'c') {
      restIndex += 1;
      return '';
    }

    const value = rest[restIndex];
    restIndex += 1;
    return value === undefined ? '' : serialize(value);
  });

  const remaining = rest
    .slice(restIndex)
    .map(serialize)
    .filter(Boolean);

  return cleanText([formatted, ...remaining].filter(Boolean).join(' '));
}

function emit(
  logger: Logger,
  severityText: string,
  severityNumber: SeverityNumber,
  args: unknown[],
): void {
  const body = formatConsoleArgs(args);
  if (!body) return;

  logger.emit({
    severityText,
    severityNumber,
    body,
    attributes: { 'browser.url': location.href },
  });
}

function shouldEmit(configuredLevel: BrowserLogLevel, severity: BrowserLogLevel): boolean {
  const priority: Record<BrowserLogLevel, number> = {
    off: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
  };
  return priority[configuredLevel] >= priority[severity];
}

export function patchConsole(logger: Logger, level: BrowserLogLevel = 'warn'): void {
  if (patched) return;

  console.debug = (...args: unknown[]) => {
    original.debug(...args);
    if (shouldEmit(level, 'debug')) {
      emit(logger, 'DEBUG', SeverityNumber.DEBUG, args);
    }
  };
  console.info = (...args: unknown[]) => {
    original.info(...args);
    if (shouldEmit(level, 'info')) {
      emit(logger, 'INFO', SeverityNumber.INFO, args);
    }
  };
  console.log = (...args: unknown[]) => {
    original.log(...args);
    if (shouldEmit(level, 'info')) {
      emit(logger, 'INFO', SeverityNumber.INFO, args);
    }
  };
  console.warn = (...args: unknown[]) => {
    original.warn(...args);
    if (shouldEmit(level, 'warn')) {
      emit(logger, 'WARN', SeverityNumber.WARN, args);
    }
  };
  console.error = (...args: unknown[]) => {
    original.error(...args);
    if (shouldEmit(level, 'error')) {
      emit(logger, 'ERROR', SeverityNumber.ERROR, args);
    }
  };

  patched = true;
}
