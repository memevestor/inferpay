import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "InferPay — AI agents pay USDC per LLM request",
  description:
    "HTTP 402 nanopayments for LLM inference. Circle Nanopayments · x402 · Arc Testnet. No accounts, no API keys.",
};

export default function LandingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
