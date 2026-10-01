const target =
  process.env.LOAD_TEST_URL ?? "http://127.0.0.1:4000/api/v1/health";
const total = Number(process.env.LOAD_TEST_REQUESTS ?? 200);
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY ?? 20);
const timeoutMs = Number(process.env.LOAD_TEST_TIMEOUT_MS ?? 3000);
const maximumP95Ms = Number(process.env.LOAD_TEST_MAX_P95_MS ?? 500);

for (const [name, value] of Object.entries({
  total,
  concurrency,
  timeoutMs,
  maximumP95Ms,
})) {
  if (!Number.isInteger(value) || value < 1)
    throw new Error(`${name} must be a positive integer`);
}
if (concurrency > total)
  throw new Error("LOAD_TEST_CONCURRENCY cannot exceed LOAD_TEST_REQUESTS");

let cursor = 0;
const durations = [];
const failures = [];

async function worker() {
  while (cursor < total) {
    const requestNumber = ++cursor;
    const started = performance.now();
    try {
      const response = await fetch(target, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      const duration = performance.now() - started;
      durations.push(duration);
      if (!response.ok)
        failures.push({ requestNumber, status: response.status });
      await response.arrayBuffer();
    } catch (error) {
      failures.push({
        requestNumber,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
durations.sort((left, right) => left - right);
const percentile = (fraction) =>
  durations[
    Math.min(durations.length - 1, Math.ceil(durations.length * fraction) - 1)
  ] ?? Infinity;
const result = {
  target,
  requests: total,
  concurrency,
  failures: failures.length,
  p50Ms: Number(percentile(0.5).toFixed(1)),
  p95Ms: Number(percentile(0.95).toFixed(1)),
  p99Ms: Number(percentile(0.99).toFixed(1)),
};
console.log(JSON.stringify(result));

if (failures.length)
  throw new Error(`Load smoke had ${failures.length} failed requests`);
if (result.p95Ms > maximumP95Ms)
  throw new Error(
    `Load smoke p95 ${result.p95Ms}ms exceeded ${maximumP95Ms}ms`,
  );
