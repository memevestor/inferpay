// x402 v2 payment flow — Circle Nanopayments (BatchFacilitatorClient)

import { BatchFacilitatorClient, GatewayEvmScheme } from "@circle-fin/x402-batching/server";

const ARC_TESTNET = "eip155:5042002";

export const facilitator = new BatchFacilitatorClient();
const gatewayScheme = new GatewayEvmScheme();

type SupportedKind = Awaited<ReturnType<BatchFacilitatorClient["getSupported"]>>["kinds"][number];

let _arcKind: SupportedKind | null = null;

async function getArcKind(): Promise<SupportedKind> {
  if (_arcKind) return _arcKind;
  const supported = await facilitator.getSupported();
  const kind = supported.kinds.find((k) => k.network === ARC_TESTNET);
  if (!kind) throw new Error(`Arc Testnet (${ARC_TESTNET}) not found in getSupported()`);
  _arcKind = kind;
  return kind;
}

// "0.001" → "1000" (USDC 6 decimals, bigint arithmetic — no float)
function usdcToAtomic(price: string): string {
  const [whole = "0", frac = ""] = price.split(".");
  const padded = frac.padEnd(6, "0").slice(0, 6);
  return (BigInt(whole) * 1_000_000n + BigInt(padded)).toString();
}

export async function buildPaymentRequirements(
  price: string,
  payTo: string
): Promise<unknown> {
  const arcKind = await getArcKind();
  const assets = arcKind.extra?.assets as Array<{ address: string }> | undefined;
  const usdcAddress = assets?.[0]?.address ?? "";

  const base = {
    scheme: "exact",
    network: ARC_TESTNET,
    asset: usdcAddress,
    amount: usdcToAtomic(price),
    payTo,
    // Docs: buyer signatures must be valid for at least 3 days
    maxTimeoutSeconds: 259200,
    extra: {},
  };

  // Merges arcKind.extra (verifyingContract, name, version) into requirements.extra
  // so buyer SDK can construct the correct EIP-712 signing domain.
  return gatewayScheme.enhancePaymentRequirements(
    base as never,
    { ...arcKind, network: arcKind.network as `${string}:${string}` },
    []
  );
}

export function build402ResponseBody(requirements: unknown, resourceUrl: string) {
  return {
    x402Version: 2,
    error: "Payment Required",
    resource: { url: resourceUrl, description: "LLM inference", mimeType: "application/json" },
    accepts: [requirements],
  };
}

// Returns the raw X-Payment header string — passed directly to BatchFacilitatorClient.verify/settle
export function extractPaymentHeader(
  headers: Headers
): { ok: true; raw: string } | { ok: false; error: string } {
  const raw = headers.get("X-Payment") ?? headers.get("x-payment");
  if (!raw) return { ok: false, error: "Missing X-Payment header" };
  return { ok: true, raw };
}

export async function verifyPayment(
  raw: string,
  requirements: unknown
): Promise<{ ok: true; payer: string } | { ok: false; error: string }> {
  const result = await facilitator.verify(
    raw as never,
    requirements as never
  );
  if (!result.isValid) {
    return { ok: false, error: result.invalidReason ?? "Payment invalid" };
  }
  return { ok: true, payer: result.payer ?? "unknown" };
}

export async function settlePayment(
  raw: string,
  requirements: unknown
): Promise<{ ok: true; payer: string; transaction: string } | { ok: false; error: string }> {
  const result = await facilitator.settle(
    raw as never,
    requirements as never
  );
  if (!result.success) {
    return { ok: false, error: result.errorReason ?? "Settlement failed" };
  }
  return { ok: true, payer: result.payer ?? "unknown", transaction: result.transaction };
}
