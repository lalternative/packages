/**
 * @skalpai/sdk-node
 *
 * Zero-config observability SDK for Node.js apps.
 * Auto-instruments traces, logs, and runtime metrics.
 *
 * Usage:
 *   import '@skalpai/sdk-node'
 *
 * Environment variables:
 *   SKALPAI_API_URL   — Skalpai backend URL (e.g. http://localhost:4100)
 *   SKALPAI_ENDPOINT  — Legacy alias for SKALPAI_API_URL
 *   SKALPAI_API_KEY   — Project API key
 *   SKALPAI_SERVICE   — Service name (default: OTEL_SERVICE_NAME, npm_package_name, or "unknown")
 *   SKALPAI_ENABLED   — Set to "false" to disable (default: "true")
 */

export { init, shutdown } from './sdk.js';
export type { SkalpaiConfig } from './sdk.js';

// Auto-initialize unless explicitly disabled
import { init } from './sdk.js';

if (process.env.SKALPAI_AUTO_INIT !== 'false') {
  const endpoint = process.env.SKALPAI_API_URL || process.env.SKALPAI_ENDPOINT;
  const apiKey = process.env.SKALPAI_API_KEY;

  if (endpoint && apiKey) {
    init({
      endpoint,
      apiKey,
      serviceName:
        process.env.SKALPAI_SERVICE ||
        process.env.OTEL_SERVICE_NAME ||
        process.env.npm_package_name ||
        'unknown',
    });
  } else {
    console.warn('[skalpai] disabled: missing SKALPAI_API_URL/SKALPAI_ENDPOINT or SKALPAI_API_KEY');
  }
}
