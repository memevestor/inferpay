export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { peekRateLimit } from "@/lib/rate-limit";
import { MODEL_PRICES } from "@/lib/pricing";

const DEMO_MODELS = [
  "meta-llama/llama-3.1-70b-instruct",
  "anthropic/claude-sonnet-4-6",
  "openai/gpt-4o",
  "anthropic/claude-opus-4-6",
];

const LIMIT = 5;
const WINDOW_MS = 60_000;

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function GET(req: NextRequest) {
  const ip = getIp(req);
  const { available, remaining, resetAt } = peekRateLimit(ip, LIMIT, WINDOW_MS);

  if (!available) {
    return NextResponse.json(
      { available: false, remaining: 0, resetAt: Math.floor(resetAt / 1000) },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  return NextResponse.json(
    {
      available: true,
      remaining,
      limit: LIMIT,
      window_seconds: WINDOW_MS / 1000,
      models: DEMO_MODELS.filter((m) => m in MODEL_PRICES),
    },
    { headers: { "Access-Control-Allow-Origin": "*" } }
  );
}
