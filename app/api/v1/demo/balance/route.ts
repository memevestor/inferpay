export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { GatewayClient } from "@circle-fin/x402-batching/client";

export async function GET() {
  const privateKey = process.env.DEMO_BUYER_PRIVATE_KEY as `0x${string}` | undefined;

  if (!privateKey) {
    return NextResponse.json(
      { error: "Demo wallet not configured" },
      { status: 503, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  const buyer = new GatewayClient({ chain: "arcTestnet", privateKey });
  const balances = await buyer.getBalances();

  return NextResponse.json(
    {
      address: buyer.address,
      wallet_balance_usdc: balances.wallet.formatted,
      gateway_balance_usdc: balances.gateway.formattedAvailable,
      network: "ARC-TESTNET",
      note: "Demo buyer Gateway wallet balance. Refilled from faucet when low.",
    },
    { headers: { "Access-Control-Allow-Origin": "*" } }
  );
}
