export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { checkRateLimit } from "@/lib/rate-limit";
import { getPriceForModel, MODEL_PRICES } from "@/lib/pricing";
import type { ChatMessage } from "@/lib/llm";

const MERCHANT_ADDRESS = process.env.CIRCLE_WALLET_ADDRESS!;

const LIMIT = 5;
const WINDOW_MS = 60_000;

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  // Rate limit
  const ip = getIp(req);
  const rl = checkRateLimit(ip, LIMIT, WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        remaining: 0,
        resetAt: Math.floor(rl.resetAt / 1000),
      },
      { status: 429, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  // Validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("model" in body) ||
    !("messages" in body)
  ) {
    return NextResponse.json({ error: "Missing model or messages" }, { status: 400 });
  }

  const { model, messages } = body as { model: string; messages: ChatMessage[] };

  if (typeof model !== "string" || !(model in MODEL_PRICES)) {
    return NextResponse.json(
      { error: `Unknown model. Valid: ${Object.keys(MODEL_PRICES).join(", ")}` },
      { status: 400 }
    );
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages must be a non-empty array" }, { status: 400 });
  }

  const privateKey = process.env.DEMO_BUYER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!privateKey) {
    return NextResponse.json(
      { error: "Demo mode not configured. DEMO_BUYER_PRIVATE_KEY missing." },
      { status: 503, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  const price = getPriceForModel(model);
  const steps: object[] = [];
  const startMs = Date.now();

  // ── Step 1: show what the 402 challenge looks like ───────────────────────
  steps.push({
    step: "request",
    description: "POST to /api/v1/chat/completions without payment",
    status: 402,
    timestamp: new Date().toISOString(),
    data: {
      amount_usdc: price,
      payTo: MERCHANT_ADDRESS,
    },
  });

  // ── Step 2: GatewayClient pays via real x402 Nanopayments flow ───────────
  const buyer = new GatewayClient({ chain: "arcTestnet", privateKey });

  const balances = await buyer.getBalances();
  if (balances.gateway.available === 0n) {
    return NextResponse.json(
      {
        error: "Demo wallet Gateway balance is empty. Try again later.",
        gateway_balance_usdc: balances.gateway.formattedAvailable,
      },
      { status: 503, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  // buyer.pay() fires the full 402 → sign EIP-3009 → settle flow
  const inferUrl = `${req.nextUrl.origin}/api/v1/chat/completions`;

  type OpenAIResponse = {
    choices?: { message?: { content?: string } }[];
    usage?: { total_tokens?: number };
  };

  let payResult: Awaited<ReturnType<typeof buyer.pay<OpenAIResponse>>>;
  try {
    payResult = await buyer.pay<OpenAIResponse>(inferUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages }),
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Demo payment failed: ${String(e)}` },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  steps.push({
    step: "payment",
    description: "Demo buyer signs EIP-3009 authorization and settles via Circle Gateway",
    status: "completed",
    timestamp: new Date().toISOString(),
    data: {
      from: buyer.address,
      to: MERCHANT_ADDRESS,
      amount_usdc: payResult.formattedAmount,
      tx_hash: payResult.transaction,
    },
  });

  // ── Step 3: LLM response ─────────────────────────────────────────────────
  const llmJson = payResult.data;
  const llmResponse = llmJson?.choices?.[0]?.message?.content ?? "(no response)";
  const tokensUsed = llmJson?.usage?.total_tokens ?? 0;

  steps.push({
    step: "response",
    description: "LLM inference delivered",
    status: payResult.status,
    timestamp: new Date().toISOString(),
    data: { model, tokens_used: tokensUsed },
  });

  const totalMs = Date.now() - startMs;

  return NextResponse.json(
    {
      steps,
      llm_response: llmResponse,
      total_time_ms: totalMs,
      price_usdc: price,
      tx_hash: payResult.transaction,
      mode: "demo",
      note: "This demo used a pre-funded testnet Gateway wallet. In production, YOUR agent pays.",
    },
    { headers: { "Access-Control-Allow-Origin": "*" } }
  );
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
