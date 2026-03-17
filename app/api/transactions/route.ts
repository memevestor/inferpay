export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { listTransactions, updateTxHash } from "@/lib/db";
import { resolvePendingHashes } from "@/lib/arcscan";

export function GET() {
  const txs = listTransactions(20) as Array<{
    id: number;
    payer: string;
    amount_usdc: string;
    tx_hash: string | null;
  }>;

  // Lazy bulk resolution: one ArcScan query resolves all pending UUID hashes at once.
  const pending = txs.filter((tx) => tx.tx_hash && !tx.tx_hash.startsWith("0x"));
  if (pending.length > 0) {
    void resolvePendingHashes(pending).then((resolved) => {
      resolved.forEach((hash, id) => updateTxHash(id, hash));
    });
  }

  return NextResponse.json(txs);
}
