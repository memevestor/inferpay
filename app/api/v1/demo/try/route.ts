export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getPriceForModel, MODEL_PRICES } from "@/lib/pricing";
import { build402Response } from "@/lib/nanopay";
import { sendUsdcTransfer, getWalletBalance } from "@/lib/circle";
import { proxyToOpenRouter } from "@/lib/llm";
import { insertTransaction } from "@/lib/db";
import type { ChatMessage } from "@/lib/llm";

const MERCHANT_ADDRESS = process.env.CIRCLE_WALLET_ADDRESS!;
const DEMO_BUYER_ADDRESS = process.env.DEMO_BUYER_WALLET_ADDRESS!;
const DEMO_BUYER_WALLET_ID = process.env.DEMO_BUYER_WALLET_ID!;

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

  if (!DEMO_BUYER_ADDRESS || !DEMO_BUYER_WALLET_ID) {
    return NextResponse.json(
      { error: "Demo mode not configured. DEMO_BUYER_WALLET_ID/ADDRESS missing." },
      { status: 503 }
    );
  }

  const price = getPriceForModel(model);
  const steps: object[] = [];
  const startMs = Date.now();

  // ── Step 1: request (simulate 402) ──────────────────────────────────────
  const payment402 = build402Response(price, MERCHANT_ADDRESS, `Inference: ${model}`);
  steps.push({
    step: "request",
    description: "POST to /api/v1/chat/completions without payment",
    status: 402,
    timestamp: new Date().toISOString(),
    data: {
      amount: payment402.amount,
      payTo: payment402.payTo,
      price_usdc: price,
    },
  });

  // ── Step 2: real USDC transfer via Circle ────────────────────────────────
  const balResult = await getWalletBalance(DEMO_BUYER_WALLET_ID);
  if (balResult.ok && parseFloat(balResult.data) < parseFloat(price) * 2) {
    return NextResponse.json(
      {
        error: "Demo wallet is low on funds. Try again later.",
        balance_usdc: balResult.data,
      },
      { status: 503, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  const transfer = await sendUsdcTransfer(DEMO_BUYER_WALLET_ID, MERCHANT_ADDRESS, price);
  if (!transfer.ok) {
    return NextResponse.json(
      { error: `Demo payment failed: ${transfer.error}` },
      { status: 500 }
    );
  }

  const payer = DEMO_BUYER_ADDRESS;
  const amount = price;
  const txId = transfer.data.txId;
  steps.push({
    step: "payment",
    description: "Demo buyer signs and sends USDC payment",
    status: "completed",
    timestamp: new Date().toISOString(),
    data: {
      from: payer,
      to: MERCHANT_ADDRESS,
      amount_usdc: amount,
      tx_hash: txId,
    },
  });

  // ── Step 3: LLM inference ────────────────────────────────────────────────
  const llmResult = await proxyToOpenRouter({ model, messages });
  if (!llmResult.ok) {
    return NextResponse.json(
      { error: `LLM error: ${llmResult.error}` },
      { status: 503 }
    );
  }

  let llmJson: { choices?: { message?: { content?: string } }[]; usage?: { total_tokens?: number } };
  try {
    llmJson = await llmResult.data.json();
  } catch {
    return NextResponse.json({ error: "Failed to parse LLM response" }, { status: 502 });
  }

  const llmResponse = llmJson.choices?.[0]?.message?.content ?? "(no response)";
  const tokensUsed = llmJson.usage?.total_tokens ?? 0;

  steps.push({
    step: "response",
    description: "LLM inference delivered",
    status: 200,
    timestamp: new Date().toISOString(),
    data: { model, tokens_used: tokensUsed },
  });

  // ── Log to SQLite ────────────────────────────────────────────────────────
  insertTransaction({
    payer,
    model,
    amount_usdc: amount,
    tx_hash: txId ?? undefined,
    status: "demo",
  });

  const totalMs = Date.now() - startMs;

  return NextResponse.json(
    {
      steps,
      llm_response: llmResponse,
      total_time_ms: totalMs,
      price_usdc: price,
      tx_hash: txId,
      mode: "demo",
      note: "This demo used a pre-funded testnet wallet. In production, YOUR agent pays.",
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
