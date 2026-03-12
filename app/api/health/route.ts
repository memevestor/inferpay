import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    merchant: process.env.CIRCLE_WALLET_ADDRESS,
    chain: process.env.CIRCLE_WALLET_BLOCKCHAIN,
    timestamp: new Date().toISOString(),
  });
}
