import type { MeterProvider } from '@opentelemetry/sdk-metrics';

interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

/** Collect browser performance metrics and return a cleanup function. */
export function startBrowserMetrics(
  provider: MeterProvider,
  serviceName: string,
): () => void {
  const meter = provider.getMeter(serviceName);

  const ttfbGauge = meter.createObservableGauge('browser.ttfb', {
    description: 'Time to first byte in ms',
    unit: 'ms',
  });
  const domInteractiveGauge = meter.createObservableGauge('browser.dom_interactive', {
    description: 'DOM interactive time in ms',
    unit: 'ms',
  });
  const loadGauge = meter.createObservableGauge('browser.load_time', {
    description: 'Page load time in ms',
    unit: 'ms',
  });

  let navTiming: { ttfb: number; domInteractive: number; loadTime: number } | null = null;

  function collectNavTiming() {
    const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (entries.length > 0) {
      const nav = entries[0];
      navTiming = {
        ttfb: nav.responseStart - nav.requestStart,
        domInteractive: nav.domInteractive - nav.startTime,
        loadTime: nav.loadEventEnd - nav.startTime,
      };
    }
  }

  if (document.readyState === 'complete') {
    collectNavTiming();
  } else {
    window.addEventListener('load', collectNavTiming, { once: true });
  }

  ttfbGauge.addCallback((result) => {
    if (navTiming) result.observe(navTiming.ttfb);
  });
  domInteractiveGauge.addCallback((result) => {
    if (navTiming) result.observe(navTiming.domInteractive);
  });
  loadGauge.addCallback((result) => {
    if (navTiming) result.observe(navTiming.loadTime);
  });

  // JS heap memory (Chrome only)
  const perf = performance as Performance & { memory?: PerformanceMemory };
  if (perf.memory) {
    const heapUsedGauge = meter.createObservableGauge('browser.js_heap_used', {
      description: 'JS heap used in bytes',
      unit: 'By',
    });
    const heapTotalGauge = meter.createObservableGauge('browser.js_heap_total', {
      description: 'JS heap total in bytes',
      unit: 'By',
    });

    heapUsedGauge.addCallback((result) => {
      if (perf.memory) result.observe(perf.memory.usedJSHeapSize);
    });
    heapTotalGauge.addCallback((result) => {
      if (perf.memory) result.observe(perf.memory.totalJSHeapSize);
    });
  }

  return () => {};
}
