const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 60_000;
const RATE_LIMIT_BACKOFF_MS = 30_000;

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export async function chatCompletion(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "openrouter/free";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const response = await requestWithRetry(apiKey, model, messages, false);
  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error(`OpenRouter response missing message content: ${JSON.stringify(data)}`);
  }

  return content;
}

async function requestWithRetry(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  isRetry: boolean
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    throw new Error(`OpenRouter request failed: ${(err as Error).message}`);
  }
  clearTimeout(timeoutId);

  if (response.status === 429 && !isRetry) {
    console.warn(`[llm] rate limited (429), retrying once after ${RATE_LIMIT_BACKOFF_MS / 1000}s`);
    await sleep(RATE_LIMIT_BACKOFF_MS);
    return requestWithRetry(apiKey, model, messages, true);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${body}`);
  }

  return response;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
