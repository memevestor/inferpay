import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function makeClient() {
  return initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  });
}

export async function getWalletBalance(walletId: string): Promise<Result<string>> {
  try {
    const client = makeClient();
    const res = await client.getWalletTokenBalance({ id: walletId });
    const tokenBalances = res.data?.tokenBalances ?? [];
    const usdc = tokenBalances.find((b) =>
      b.token?.symbol?.toUpperCase() === "USDC"
    );
    return { ok: true, data: usdc?.amount ?? "0" };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function validateNanopayment(
  paymentHeader: string,
  expectedAmount: string,
  merchantAddress: string
): Promise<Result<{ payer: string; amount: string }>> {
  // Circle Nanopayments validation: parse the X-Payment header (EIP-3009 signed auth)
  // Header format: base64-encoded JSON containing { signature, from, to, value, validAfter, validBefore, nonce }
  try {
    const decoded = JSON.parse(Buffer.from(paymentHeader, "base64").toString("utf8"));

    if (!decoded.from || !decoded.value) {
      return { ok: false, error: "Invalid payment header: missing fields" };
    }

    // Validate recipient is our merchant wallet
    if (decoded.to?.toLowerCase() !== merchantAddress.toLowerCase()) {
      return { ok: false, error: "Payment recipient mismatch" };
    }

    // Arc Testnet USDC: 6 decimals (confirmed via arcscan.app on-chain token data)
    // Circle SDK incorrectly reports decimals=18 for this token — ignore it
    const expectedUnits = BigInt(Math.round(parseFloat(expectedAmount) * 1_000_000));
    const actualUnits = BigInt(decoded.value);

    if (actualUnits < expectedUnits) {
      return {
        ok: false,
        error: `Insufficient payment: got ${actualUnits}, need ${expectedUnits}`,
      };
    }

    // Check validity window
    const now = Math.floor(Date.now() / 1000);
    if (decoded.validBefore && now > Number(decoded.validBefore)) {
      return { ok: false, error: "Payment authorization expired" };
    }
    if (decoded.validAfter && now < Number(decoded.validAfter)) {
      return { ok: false, error: "Payment authorization not yet valid" };
    }

    return {
      ok: true,
      data: {
        payer: decoded.from,
        amount: (Number(actualUnits) / 1_000_000).toFixed(6),
        txId: (decoded.txId ?? decoded.nonce ?? null) as string | null,
      },
    };
  } catch (e) {
    return { ok: false, error: `Payment parse error: ${String(e)}` };
  }
}
