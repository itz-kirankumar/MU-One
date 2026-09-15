/**
 * Exponential backoff with jitter for Google API calls.
 * Retries on 429 (rate limit) and 5xx (server) errors.
 */

const DEFAULT_MAX_RETRIES = 4;
const DEFAULT_BASE_DELAY_MS = 500;

/**
 * Executes an async function with exponential backoff and jitter.
 * @param fn - The async function to execute.
 * @param maxRetries - Maximum number of retry attempts (default: 4).
 * @param baseDelayMs - Base delay in milliseconds (default: 500ms).
 * @returns The resolved value of fn.
 * @throws The last error if all retries are exhausted.
 */
export async function withBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = DEFAULT_MAX_RETRIES,
  baseDelayMs: number = DEFAULT_BASE_DELAY_MS
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;

      if (!isRetryable(err) || attempt === maxRetries) {
        throw err;
      }

      const delay = computeDelay(attempt, baseDelayMs, err);
      await sleep(delay);
    }
  }

  throw lastError;
}

function isRetryable(err: unknown): boolean {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;

    // googleapis errors expose .code or .status
    const status =
      typeof e["status"] === "number"
        ? e["status"]
        : typeof e["code"] === "number"
        ? e["code"]
        : null;

    if (status !== null) {
      return status === 429 || (status >= 500 && status < 600);
    }

    // GaxiosError / googleapis v2 pattern
    const response = e["response"] as Record<string, unknown> | undefined;
    if (response) {
      const responseStatus =
        typeof response["status"] === "number" ? response["status"] : null;
      if (responseStatus !== null) {
        return (
          responseStatus === 429 ||
          (responseStatus >= 500 && responseStatus < 600)
        );
      }
    }

    // Check Retry-After header scenario
    const errors = e["errors"];
    if (Array.isArray(errors)) {
      return errors.some(
        (e2: unknown) =>
          e2 &&
          typeof e2 === "object" &&
          (e2 as Record<string, unknown>)["reason"] === "rateLimitExceeded"
      );
    }
  }
  return false;
}

function computeDelay(
  attempt: number,
  baseDelayMs: number,
  err: unknown
): number {
  // Respect Retry-After header if present
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const response = e["response"] as Record<string, unknown> | undefined;
    if (response) {
      const headers = response["headers"] as Record<string, string> | undefined;
      if (headers) {
        const retryAfter =
          headers["retry-after"] ?? headers["Retry-After"] ?? null;
        if (retryAfter) {
          const seconds = parseInt(retryAfter, 10);
          if (!isNaN(seconds)) {
            return seconds * 1000;
          }
        }
      }
    }
  }

  // Exponential backoff: baseDelay * 2^attempt + random jitter up to baseDelay
  const exponential = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * baseDelayMs;
  return Math.min(exponential + jitter, 32000); // cap at 32s
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
