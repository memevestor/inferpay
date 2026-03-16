import { NextResponse } from "next/server";
import { GatewayClient } from "@circle-fin/x402-batching/client";

// Returns demo buyer Gateway balance for the playground UI
export async function GET() {
  const privateKey = process.env.DEMO_BUYER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!privateKey) {
    return NextResponse.json({ error: "DEMO_BUYER_PRIVATE_KEY not configured" }, { status: 500 });
  }

  const buyer = new GatewayClient({ chain: "arcTestnet", privateKey });
  const balances = await buyer.getBalances();

  return NextResponse.json({
    address: buyer.address,
    wallet_balance: balances.wallet.formatted,
    gateway_balance: balances.gateway.formattedAvailable,
  });
}
