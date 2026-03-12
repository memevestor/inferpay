// x402 payment flow helpers

export type PaymentRequired = {
  version: number;
  scheme: "exact";
  network: string;
  amount: string;
  asset: "USDC";
  payTo: string;
  memo?: string;
};

export function build402Response(
  price: string,
  merchantAddress: string,
  memo?: string
): PaymentRequired {
  return {
    version: 1,
    scheme: "exact",
    network: "arc-testnet",
    amount: price,
    asset: "USDC",
    payTo: merchantAddress,
    memo,
  };
}

export function extractPaymentHeader(headers: Headers): string | null {
  return headers.get("X-Payment") ?? headers.get("x-payment");
}
