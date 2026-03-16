// ArcScan (Blockscout) API — resolves Circle settlement UUID → real onchain 0x... tx hash
// Arc Testnet has sub-second finality, so the tx is usually confirmed within 3 seconds of settle()

const ARCSCAN_API = "https://testnet.arcscan.app";

export async function lookupOnchainTxHash(
  payer: string,
  amountAtomic: string,
  usdcAddress: string
): Promise<string | null> {
  if (!payer || !amountAtomic || !usdcAddress) return null;

  // Arc Testnet has sub-second finality, but Circle's batch processing adds a few seconds
  await new Promise((r) => setTimeout(r, 3000));

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(
      `${ARCSCAN_API}/api/v2/addresses/${payer}/token-transfers?type=ERC-20`
    ).catch(() => null);

    if (!res?.ok) break;

    const data = await res.json().catch(() => null);
    if (!data) break;

    const now = Date.now();
    const match = (data.items ?? []).find((item: Record<string, unknown>) => {
      const token = item.token as { address?: string } | undefined;
      const total = item.total as { value?: string } | undefined;
      const ts = item.timestamp as string | undefined;
      return (
        token?.address?.toLowerCase() === usdcAddress.toLowerCase() &&
        total?.value === amountAtomic &&
        ts !== undefined &&
        now - new Date(ts).getTime() < 120_000
      );
    });

    if (match) return (match as { tx_hash: string }).tx_hash;

    if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
  }

  return null;
}
