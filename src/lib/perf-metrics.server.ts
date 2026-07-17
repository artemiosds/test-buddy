// In-memory performance ring buffer. Server-only (persists per Worker isolate).
// Não persiste em banco; some quando o isolate recicla. Consumido pelo /saude.

export type PerfSample = {
  ts: number;
  method: string;
  path: string;
  status: number;
  duration_ms: number;
};

const MAX_SAMPLES = 1000;
const buffer: PerfSample[] = [];
let totalRequests = 0;
const bootedAt = Date.now();

export function recordRequest(sample: PerfSample) {
  totalRequests += 1;
  buffer.push(sample);
  if (buffer.length > MAX_SAMPLES) {
    buffer.splice(0, buffer.length - MAX_SAMPLES);
  }
}

export function snapshotMetrics() {
  return {
    booted_at: bootedAt,
    total_requests: totalRequests,
    sample_size: buffer.length,
    samples: buffer.slice(),
    gerado_em: new Date().toISOString(),
  };
}