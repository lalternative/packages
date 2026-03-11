/**
 * @skalpel/sdk-node
 *
 * Zero-config observability SDK for Node.js apps.
 * Auto-instruments traces, logs, and runtime metrics.
 *
 * Usage:
 *   import '@skalpel/sdk-node'
 *
 * Environment variables:
 *   SKALPEL_API_URL   — Skalpel backend URL (e.g. http://localhost:4100)
 *   SKALPEL_ENDPOINT  — Legacy alias for SKALPEL_API_URL
 *   SKALPEL_API_KEY   — Project API key
 *   SKALPEL_SERVICE   — Service name (default: process.env.npm_package_name or "unknown")
 *   SKALPEL_ENABLED   — Set to "false" to disable (default: "true")
 */

export { init, shutdown } from './sdk.js';
export type { SkalpelConfig } from './sdk.js';

// Auto-initialize unless explicitly disabled
import { init } from './sdk.js';

if (process.env.SKALPEL_AUTO_INIT !== 'false') {
  const endpoint = process.env.SKALPEL_API_URL || process.env.SKALPEL_ENDPOINT;
  const apiKey = process.env.SKALPEL_API_KEY;

  if (endpoint && apiKey) {
    init({
      endpoint,
      apiKey,
      serviceName: process.env.SKALPEL_SERVICE || process.env.npm_package_name || 'unknown',
    });
  } else {
    console.warn('[skalpel] disabled: missing SKALPEL_API_URL/SKALPEL_ENDPOINT or SKALPEL_API_KEY');
  }
}
