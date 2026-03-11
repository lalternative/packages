import type { MeterProvider } from '@opentelemetry/sdk-metrics';

/**
 * Collect Node.js runtime metrics and return a cleanup function.
 */
export function startRuntimeMetrics(
  provider: MeterProvider,
  serviceName: string,
): () => void {
  const meter = provider.getMeter(serviceName);

  const cpuGauge = meter.createObservableGauge('process.cpu.utilization', {
    description: 'Process CPU utilization (0-1)',
  });
  const heapGauge = meter.createObservableGauge('process.runtime.nodejs.memory.heap_used', {
    description: 'Node.js heap used in bytes',
    unit: 'By',
  });
  const rssGauge = meter.createObservableGauge('process.memory.rss', {
    description: 'Resident set size in bytes',
    unit: 'By',
  });
  const eventLoopLagGauge = meter.createObservableGauge('process.runtime.nodejs.event_loop.lag', {
    description: 'Event loop lag in seconds',
    unit: 's',
  });

  let prevCpu = process.cpuUsage();
  let prevTime = process.hrtime.bigint();

  cpuGauge.addCallback((result) => {
    const cpu = process.cpuUsage();
    const now = process.hrtime.bigint();
    const elapsedUs = Number(now - prevTime) / 1_000;
    if (elapsedUs > 0) {
      const userDelta = cpu.user - prevCpu.user;
      const systemDelta = cpu.system - prevCpu.system;
      result.observe(Math.min((userDelta + systemDelta) / elapsedUs, 1));
    }
    prevCpu = cpu;
    prevTime = now;
  });

  heapGauge.addCallback((result) => {
    result.observe(process.memoryUsage().heapUsed);
  });

  rssGauge.addCallback((result) => {
    result.observe(process.memoryUsage().rss);
  });

  let lastLag = 0;
  const interval = setInterval(() => {
    const start = process.hrtime.bigint();
    setTimeout(() => {
      const elapsed = Number(process.hrtime.bigint() - start) / 1e9;
      lastLag = Math.max(0, elapsed - 0.001);
    }, 1);
  }, 5_000);
  interval.unref();

  eventLoopLagGauge.addCallback((result) => {
    result.observe(lastLag);
  });

  return () => clearInterval(interval);
}
