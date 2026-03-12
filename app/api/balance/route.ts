import { NextResponse } from "next/server";
import { getWalletBalance } from "@/lib/circle";

// Returns buyer wallet USDC balance for the playground demo
export async function GET() {
  const walletId = process.env.BUYER_WALLET_ID;
  if (!walletId) {
    return NextResponse.json({ error: "BUYER_WALLET_ID not configured" }, { status: 500 });
  }

  const result = await getWalletBalance(walletId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 503 });
  }

  return NextResponse.json({ balance: result.data });
}
