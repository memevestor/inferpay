// ArcScan (Blockscout) API — resolves Circle settlement UUID → real onchain 0x... tx hash
//
// Circle batched settlement submits EIP-3009 transferWithAuthorization via their relayer.
// The token transfer appears at the MERCHANT address (not payer), with from.hash = payer.
// Batch settlement can take minutes to hours — so we retry for up to ~10 minutes.

const ARCSCAN_API = "https://testnet.arcscan.app";
const MERCHANT_ADDRESS = process.env.CIRCLE_WALLET_ADDRESS ?? "";

export async function lookupOnchainTxHash(
  payer: string,
  amountAtomic: string,
  _usdcAddress: string
): Promise<string | null> {
  if (!payer || !amountAtomic || !MERCHANT_ADDRESS) return null;

  // Circle batches payments — initial delay before first query
  await new Promise((r) => setTimeout(r, 5000));

  // Retry for up to ~10 minutes (6 attempts, doubling interval: 5s, 10s, 20s, 40s, 80s, 160s)
  let delay = 10_000;
  for (let attempt = 0; attempt < 6; attempt++) {
    const hash = await queryMerchantTransfers(payer, amountAtomic);
    if (hash) return hash;
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, 120_000); // cap at 2 minutes between retries
  }

  return null;
}

async function queryMerchantTransfers(payer: string, amountAtomic: string): Promise<string | null> {
  const res = await fetch(
    `${ARCSCAN_API}/api/v2/addresses/${MERCHANT_ADDRESS}/token-transfers?type=ERC-20`
  ).catch(() => null);

  if (!res?.ok) return null;

  const data = await res.json().catch(() => null);
  if (!data) return null;

  const now = Date.now();
  const match = (data.items ?? []).find((item: Record<string, unknown>) => {
    const from = item.from as { hash?: string } | undefined;
    const total = item.total as { value?: string } | undefined;
    const ts = item.timestamp as string | undefined;
    return (
      from?.hash?.toLowerCase() === payer.toLowerCase() &&
      total?.value === amountAtomic &&
      ts !== undefined &&
      now - new Date(ts).getTime() < 7_200_000 // within last 2 hours
    );
  });

  if (!match) return null;
  return (match as { transaction_hash?: string }).transaction_hash ?? null;
}
