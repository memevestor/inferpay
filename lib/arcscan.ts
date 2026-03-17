// ArcScan (Blockscout) API — resolves Circle settlement UUID → real onchain 0x... tx hash
//
// Circle's relayer submits EIP-3009 transferWithAuthorization on behalf of the buyer.
// The token transfer appears at the MERCHANT address (not payer), with from.hash == payer.
// Batch settlement can take minutes to hours — fire-and-forget handles new payments;
// lazy bulk resolution (called on GET /api/transactions) handles backfilling old ones.

const ARCSCAN_API = "https://testnet.arcscan.app";
const MERCHANT_ADDRESS = process.env.CIRCLE_WALLET_ADDRESS ?? "";

type ArcTransfer = { txHash: string; value: string; from: string; timestamp: string };

// Fetch one page of USDC token transfers to merchant
async function fetchMerchantTransfers(): Promise<ArcTransfer[]> {
  if (!MERCHANT_ADDRESS) return [];
  const res = await fetch(
    `${ARCSCAN_API}/api/v2/addresses/${MERCHANT_ADDRESS}/token-transfers?type=ERC-20`
  ).catch(() => null);
  if (!res?.ok) return [];
  const data = await res.json().catch(() => null);
  if (!data?.items) return [];

  return (data.items as Record<string, unknown>[]).map((item) => ({
    txHash: (item.transaction_hash as string) ?? "",
    value: ((item.total as { value?: string })?.value) ?? "",
    from: ((item.from as { hash?: string })?.hash ?? "").toLowerCase(),
    timestamp: (item.timestamp as string) ?? "",
  }));
}

// Called fire-and-forget after a new payment — waits for batch confirmation then updates DB.
// Uses exponential backoff since Circle batch may take minutes.
export async function lookupOnchainTxHash(
  payer: string,
  amountAtomic: string,
  _usdcAddress: string,
  skipDelay = false
): Promise<string | null> {
  if (!payer || !amountAtomic) return null;

  if (!skipDelay) {
    // Initial wait for Arc batch processing (sub-second finality but relayer has queue)
    await new Promise((r) => setTimeout(r, 5000));
  }

  let delay = 15_000;
  for (let attempt = 0; attempt < 6; attempt++) {
    const transfers = await fetchMerchantTransfers();
    const match = transfers.find(
      (t) => t.from === payer.toLowerCase() && t.value === amountAtomic
    );
    if (match?.txHash) return match.txHash;

    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, 180_000); // cap at 3 minutes
  }

  return null;
}

// Called from GET /api/transactions to batch-resolve all pending UUID hashes at once.
// Makes a single ArcScan query and assigns hashes to multiple pending transactions.
export async function resolvePendingHashes(
  pending: Array<{ id: number; payer: string; amount_usdc: string }>
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (!pending.length) return result;

  const transfers = await fetchMerchantTransfers().catch(() => []);
  // Already-assigned hashes track (avoid duplicate assignment within this batch)
  const used = new Set<string>();

  for (const tx of pending) {
    const amountAtomic = usdcToAtomicLocal(tx.amount_usdc);
    const match = transfers.find(
      (t) =>
        t.from === tx.payer.toLowerCase() &&
        t.value === amountAtomic &&
        !used.has(t.txHash)
    );
    if (match?.txHash) {
      result.set(tx.id, match.txHash);
      used.add(match.txHash);
    }
  }

  return result;
}

// Local copy of usdcToAtomic — avoid circular dependency with nanopay.ts
function usdcToAtomicLocal(price: string): string {
  const [whole = "0", frac = ""] = price.split(".");
  const padded = frac.padEnd(6, "0").slice(0, 6);
  return (BigInt(whole) * 1_000_000n + BigInt(padded)).toString();
}
