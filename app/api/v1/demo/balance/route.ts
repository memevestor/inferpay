export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getWalletBalance } from "@/lib/circle";

export async function GET() {
  const walletId = process.env.DEMO_BUYER_WALLET_ID;
  const address = process.env.DEMO_BUYER_WALLET_ADDRESS;

  if (!walletId || !address) {
    return NextResponse.json(
      { error: "Demo wallet not configured" },
      { status: 503, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  const result = await getWalletBalance(walletId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: 503, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  return NextResponse.json(
    {
      address,
      balance_usdc: parseFloat(result.data).toFixed(6),
      network: "ARC-TESTNET",
      note: "Demo buyer wallet balance. Refilled from faucet when low.",
    },
    { headers: { "Access-Control-Allow-Origin": "*" } }
  );
}
