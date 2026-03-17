// ArcScan (Blockscout) API — resolves Circle settlement UUID → real onchain tx hash
//
// Circle Gateway calls submitBatch() on the Gateway Wallet contract every ~5 minutes.
// Each submitBatch() settles all pending payment authorizations accumulated since the
// previous batch. The tx hash of that submitBatch IS the onchain proof of settlement.
//
// We do NOT look for ERC-20 token transfers — those don't exist for nanopayments.
// The Gateway contract updates internal balances directly via submitBatch().

const ARCSCAN_API = "https://testnet.arcscan.app";
// Circle Gateway Wallet contract on Arc Testnet (source: @circle-fin/x402-batching SDK)
const GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";

type BatchTx = { hash: string; timestamp: string };

// Fetch recent submitBatch transactions from the Gateway Wallet contract.
// Items are returned newest-first. One page = 30 items ≈ 150 minutes of batches.
async function fetchRecentBatches(pageToken?: string): Promise<{ items: BatchTx[]; nextPageToken?: string }> {
  const url = pageToken
    ? `${ARCSCAN_API}/api/v2/addresses/${GATEWAY_WALLET}/transactions?filter=to&page_token=${pageToken}`
    : `${ARCSCAN_API}/api/v2/addresses/${GATEWAY_WALLET}/transactions?filter=to`;

  const res = await fetch(url).catch(() => null);
  if (!res?.ok) return { items: [] };
  const data = await res.json().catch(() => null);
  if (!data?.items) return { items: [] };

  const items: BatchTx[] = (data.items as Record<string, unknown>[])
    .filter((item) => item.method === "submitBatch")
    .map((item) => ({
      hash: (item.hash as string) ?? "",
      timestamp: (item.timestamp as string) ?? "",
    }));

  return {
    items,
    nextPageToken: data.next_page_params?.block_number
      ? String(data.next_page_params.block_number)
      : undefined,
  };
}

// Find the first submitBatch transaction that ran AFTER the given payment time.
// SQLite stores created_at as "2026-03-16 23:59:05" (UTC, no T or Z).
async function findBatchAfter(createdAtSqlite: string, maxPages = 6): Promise<string | null> {
  const paymentMs = new Date(createdAtSqlite.replace(" ", "T") + "Z").getTime();

  let pageToken: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const { items, nextPageToken } = await fetchRecentBatches(pageToken);
    if (!items.length) break;

    // Items are newest-first. Find all batches that ran AFTER our payment.
    const batchesAfter = items.filter(
      (b) => new Date(b.timestamp).getTime() > paymentMs
    );

    if (batchesAfter.length > 0) {
      // Last item in this filtered list = oldest batch that's still after payment
      // = the first submitBatch that settled our payment
      return batchesAfter[batchesAfter.length - 1].hash;
    }

    // If the oldest item on this page is still newer than payment, we've gone past it
    const oldestOnPage = items[items.length - 1];
    if (new Date(oldestOnPage.timestamp).getTime() <= paymentMs) {
      // No batch after payment found in this page or previous pages
      break;
    }

    if (!nextPageToken) break;
    pageToken = nextPageToken;
  }

  return null;
}

// Called fire-and-forget after a new payment.
// submitBatch runs every ~5 minutes, so we wait 6 minutes then look.
export async function lookupSettlementTxHash(createdAtSqlite: string): Promise<string | null> {
  // Wait for the next submitBatch cycle (5-min cadence + buffer)
  await new Promise((r) => setTimeout(r, 6 * 60 * 1000));

  // Retry up to 3 times in case we missed the first batch
  for (let attempt = 0; attempt < 3; attempt++) {
    const hash = await findBatchAfter(createdAtSqlite);
    if (hash) return hash;
    if (attempt < 2) await new Promise((r) => setTimeout(r, 5 * 60 * 1000));
  }

  return null;
}

// Called from GET /api/transactions — bulk-resolves pending hashes in one pass.
// Uses a few pages of ArcScan to cover several hours of batch history.
export async function resolvePendingHashes(
  pending: Array<{ id: number; created_at: string }>
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (!pending.length) return result;

  // Collect enough batch history to cover the oldest pending transaction
  const allBatches: BatchTx[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 10; page++) {
    const { items, nextPageToken } = await fetchRecentBatches(pageToken);
    allBatches.push(...items);

    // Stop if we've gone back far enough (past oldest pending tx)
    if (allBatches.length > 0) {
      const oldestBatch = allBatches[allBatches.length - 1];
      const oldestPending = pending.reduce((min, tx) =>
        tx.created_at < min ? tx.created_at : min, pending[0].created_at
      );
      if (new Date(oldestBatch.timestamp).getTime() <= new Date(oldestPending.replace(" ", "T") + "Z").getTime()) {
        break;
      }
    }

    if (!nextPageToken) break;
    pageToken = nextPageToken;
    await new Promise((r) => setTimeout(r, 300)); // brief pause between pages
  }

  if (!allBatches.length) return result;

  // For each pending tx, find the first submitBatch that ran after it
  for (const tx of pending) {
    const paymentMs = new Date(tx.created_at.replace(" ", "T") + "Z").getTime();
    const batchesAfter = allBatches.filter(
      (b) => new Date(b.timestamp).getTime() > paymentMs
    );
    if (!batchesAfter.length) continue;
    // Oldest that's still after payment = first batch that settled it
    const firstBatch = batchesAfter[batchesAfter.length - 1];
    if (firstBatch.hash) {
      result.set(tx.id, firstBatch.hash);
    }
  }

  return result;
}
