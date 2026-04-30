import './index.js';

const script = document.currentScript as HTMLScriptElement | null;
if (script && typeof document !== 'undefined') {
  const el = document.createElement('skalpai-feedback');
  const apiKey = script.dataset.apiKey;
  const endpoint = script.dataset.endpoint;
  const labels = script.dataset.labels;
  if (apiKey) el.setAttribute('api-key', apiKey);
  if (endpoint) el.setAttribute('endpoint', endpoint);
  if (labels) el.setAttribute('labels', labels);

  if (document.body) {
    document.body.appendChild(el);
  } else {
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(el), { once: true });
  }
}
