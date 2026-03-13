// Demo endpoint — executes full x402 flow using a pre-funded testnet buyer wallet.
// Payment signing with Circle SDK is TODO; currently stubs tx hash for MVP display.

import { NextRequest, NextResponse } from "next/server";

type MessageParam = { role: string; content: string };

type RequestBody = {
  model: string;
  messages: MessageParam[];
};

type OpenRouterResponse = {
  choices?: Array<{ message: { content: string } }>;
  error?: { message: string };
};

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userMessage = body.messages.at(-1)?.content ?? "";

  // Deterministic-looking tx hash for UI display
  const txHash =
    "0x" +
    Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");

  // Real LLM call when OpenRouter key is configured
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: body.model,
          messages: body.messages,
          max_tokens: 512,
        }),
      });

      const data = (await res.json()) as OpenRouterResponse;

      if (data.error) {
        return NextResponse.json({ error: data.error.message }, { status: 502 });
      }

      return NextResponse.json({
        txHash,
        content: data.choices?.[0]?.message.content ?? "",
      });
    } catch {
      return NextResponse.json({ error: "LLM call failed" }, { status: 502 });
    }
  }

  // Stub response when env vars are not configured
  return NextResponse.json({
    txHash,
    content: `[Demo stub — add OPENROUTER_API_KEY to .env.local for real responses]\n\nYour message: "${userMessage}"`,
  });
}
