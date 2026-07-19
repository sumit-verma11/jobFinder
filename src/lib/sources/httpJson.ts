const DEFAULT_TIMEOUT_MS = 10_000;

export async function fetchJson<T>(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "JobPilotBot/1.0", Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`fetch failed with status ${response.status} for ${url}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}
