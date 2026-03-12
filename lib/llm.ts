export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
};

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function proxyToOpenRouter(
  req: ChatRequest
): Promise<Result<Response>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { ok: false, error: "OPENROUTER_API_KEY not configured" };

  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://inferpay.dev",
        "X-Title": "InferPay",
      },
      body: JSON.stringify(req),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      return { ok: false, error: `OpenRouter error ${upstream.status}: ${err}` };
    }

    return { ok: true, data: upstream };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
