export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { listTransactions, updateTxHash } from "@/lib/db";
import { lookupOnchainTxHash } from "@/lib/arcscan";
import { usdcToAtomic } from "@/lib/nanopay";

export function GET() {
  const txs = listTransactions(20) as Array<{
    id: number;
    payer: string;
    amount_usdc: string;
    tx_hash: string | null;
  }>;

  // Lazy resolution: for any transactions still holding a Circle UUID (not 0x hash),
  // kick off a background lookup. This ensures hashes get resolved even if the
  // initial fire-and-forget after payment was killed by a PM2 restart.
  const pending = txs.filter((tx) => tx.tx_hash && !tx.tx_hash.startsWith("0x"));
  if (pending.length > 0) {
    void (async () => {
      for (const tx of pending) {
        const hash = await lookupOnchainTxHash(tx.payer, usdcToAtomic(tx.amount_usdc), "").catch(() => null);
        if (hash) updateTxHash(tx.id, hash);
      }
    })();
  }

  return NextResponse.json(txs);
}
