import { NextRequest, NextResponse } from "next/server";
import { getPriceForModel } from "@/lib/pricing";
import { build402Response, extractPaymentHeader } from "@/lib/nanopay";
import { validateNanopayment } from "@/lib/circle";
import { proxyToOpenRouter } from "@/lib/llm";
import { insertTransaction } from "@/lib/db";

const MERCHANT_ADDRESS = process.env.CIRCLE_WALLET_ADDRESS!;

export async function POST(req: NextRequest) {
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

  const price = getPriceForModel(model);
  const paymentHeader = extractPaymentHeader(req.headers);

  // Step 1: no payment header → return 402
  if (!paymentHeader) {
    const payment402 = build402Response(price, MERCHANT_ADDRESS, `Inference: ${model}`);
    return NextResponse.json(payment402, {
      status: 402,
      headers: {
        "X-Payment-Required": "true",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // Step 2: validate payment
  const validation = await validateNanopayment(paymentHeader, price, MERCHANT_ADDRESS);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 402 });
  }

  const { payer, amount, txId } = validation.data;

  // Step 3: proxy to OpenRouter
  const llmResult = await proxyToOpenRouter({
    model,
    messages: messages as never,
    stream: stream === true,
    temperature: typeof temperature === "number" ? temperature : undefined,
    max_tokens: typeof max_tokens === "number" ? max_tokens : undefined,
  });

  if (!llmResult.ok) {
    return NextResponse.json({ error: llmResult.error }, { status: 502 });
  }

  // Step 4: log transaction
  insertTransaction({ payer, model, amount_usdc: amount, tx_hash: txId ?? undefined });

  // Stream or return response as-is
  const upstream = llmResult.data;
  const responseHeaders = new Headers();
  responseHeaders.set("Content-Type", upstream.headers.get("Content-Type") ?? "application/json");
  responseHeaders.set("Access-Control-Allow-Origin", "*");

  return new NextResponse(upstream.body, {
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
      "Access-Control-Allow-Headers": "Content-Type, X-Payment",
    },
  });
}
