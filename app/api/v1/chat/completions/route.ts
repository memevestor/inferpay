export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { calculatePrice, SUPPORTED_MODELS, MODEL_PRICING } from "@/lib/pricing";
import { estimateTokens } from "@/lib/tokens";
import {
  buildPaymentRequirements,
  build402ResponseBody,
  extractPaymentHeader,
  verifyPayment,
  settlePayment,
} from "@/lib/nanopay";
import { proxyToOpenRouter } from "@/lib/llm";
import { insertTransaction, updateTxHash } from "@/lib/db";
import { lookupSettlementTxHash } from "@/lib/arcscan";
import { checkRateLimit } from "@/lib/rate-limit";
import type { ChatMessage } from "@/lib/llm";

const MERCHANT_ADDRESS = process.env.CIRCLE_WALLET_ADDRESS!;

// 60 requests per minute per IP — generous for legit buyers, throttles spam on the 402 path
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const rl = checkRateLimit(ip, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests", resetAt: Math.floor(rl.resetAt / 1000) },
      { status: 429, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

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

  const { model, messages, stream, temperature, max_tokens } = body as Record<string, unknown>;

  if (typeof model !== "string") {
    return NextResponse.json({ error: "model must be a string" }, { status: 400 });
  }

  if (!SUPPORTED_MODELS.includes(model)) {
    return NextResponse.json(
      { error: `Unknown model. Supported: ${SUPPORTED_MODELS.join(", ")}` },
      { status: 400 }
    );
  }

  // Dynamic per-token pricing: count input tokens now, use max_tokens cap for output budget
  const inputTokens = estimateTokens(messages as ChatMessage[]);
  const maxOut =
    typeof max_tokens === "number" && max_tokens > 0
      ? max_tokens
      : MODEL_PRICING[model].maxOutputDefault;
  const price = calculatePrice(model, inputTokens, maxOut);

  const requirements = await buildPaymentRequirements(price, MERCHANT_ADDRESS);

  const parsed = extractPaymentHeader(req.headers);

  // Step 1: no payment header → return 402 with x402 v2 requirements
  // GatewayClient reads the PAYMENT-REQUIRED header (base64 of body), not just the body.
  if (!parsed.ok) {
    const resourceUrl = req.nextUrl.href;
    const body402 = build402ResponseBody(requirements, resourceUrl);
    const encoded = Buffer.from(JSON.stringify(body402)).toString("base64");
    return NextResponse.json(body402, {
      status: 402,
      headers: {
        "PAYMENT-REQUIRED": encoded,
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // Step 2: verify payment cryptographically via Circle Gateway API
  const verifyResult = await verifyPayment(parsed.payload, requirements);
  if (!verifyResult.ok) {
    return NextResponse.json(
      { error: "Payment verification failed" },
      { status: 402 }
    );
  }

  // Step 3: settle (submit to batch queue — instant confirmation, gas-free)
  const settleResult = await settlePayment(parsed.payload, requirements);
  if (!settleResult.ok) {
    return NextResponse.json(
      { error: "Payment settlement failed" },
      { status: 500 }
    );
  }

  // Step 4: proxy to LLM
  const llmResult = await proxyToOpenRouter({
    model,
    messages: messages as never,
    stream: stream === true,
    temperature: typeof temperature === "number" ? temperature : undefined,
    max_tokens: typeof max_tokens === "number" ? max_tokens : undefined,
  });

  if (!llmResult.ok) {
    return NextResponse.json({ error: "LLM unavailable" }, { status: 502 });
  }

  const upstream = llmResult.data;

  // Step 5: extract actual token usage and log transaction.
  // For streaming responses we can't read the body here — log without output tokens.
  let tokensOutput: number | undefined;
  let responseBody: BodyInit = upstream.body!;

  if (stream !== true) {
    try {
      const json = await upstream.json() as {
        choices?: unknown[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      tokensOutput = json.usage?.completion_tokens;
      responseBody = JSON.stringify(json);
    } catch {
      // If JSON parse fails, pass body as-is (will be empty though)
    }
  }

  const txId = insertTransaction({
    payer: settleResult.payer,
    model,
    amount_usdc: price,
    tx_hash: settleResult.transaction,
    tokens_input: inputTokens,
    tokens_output: tokensOutput,
  });

  // Async: wait for next submitBatch cycle (~5 min) then resolve UUID → real onchain 0x hash
  const createdAt = new Date().toISOString().replace("T", " ").slice(0, 19);
  void lookupSettlementTxHash(createdAt).then((hash) => {
    if (hash) updateTxHash(txId, hash);
  });

  const responseHeaders = new Headers();
  responseHeaders.set("Content-Type", upstream.headers.get("Content-Type") ?? "application/json");
  responseHeaders.set("Access-Control-Allow-Origin", "*");
  // GatewayClient reads PAYMENT-RESPONSE to extract transaction hash
  responseHeaders.set(
    "PAYMENT-RESPONSE",
    Buffer.from(JSON.stringify({ transaction: settleResult.transaction })).toString("base64")
  );

  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Payment, Payment-Signature",
    },
  });
}
