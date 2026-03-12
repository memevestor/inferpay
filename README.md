# InferPay — Pay-per-Inference Hub

AI proxy that accepts USDC micropayments via x402 standard for each LLM inference request.
Built on Arc Testnet with Circle Developer-Controlled Wallets and OpenRouter.

## Quick Start

```bash
cp .env.local.example .env.local  # fill in CIRCLE_API_KEY, OPENROUTER_API_KEY
npm run setup                      # create wallet, fund from faucet
npm run dev                        # start proxy on :3000
npx tsx agent/buyer.ts             # run demo buyer agent (10 requests)
```

## How It Works

```
POST /api/v1/chat/completions  (no payment)
  → 402 { amount, payTo, network, asset }

POST /api/v1/chat/completions  (X-Payment: <base64 signed auth>)
  → Circle USDC transfer validated
  → OpenRouter LLM response proxied
  → Transaction logged to SQLite
```

## Arc Testnet USDC — Decimals Note

Arc Testnet USDC uses **6 decimals** (standard), confirmed via on-chain contract at
`0x3600000000000000000000000000000000000000`. The Circle SDK `getWalletTokenBalance`
incorrectly reports `decimals: 18` for this token — this is a Circle SDK bug.
All decimal math in this codebase uses `1_000_000` (10^6), not `10^18`.

## Security (Testnet MVP)

Payment validation uses base64 JSON parsing, not cryptographic signature verification
(`ecrecover`). This is a conscious tradeoff for MVP speed.

**What this means:** any client can send a crafted `X-Payment` header with a valid
recipient address and sufficient `value` field and receive inference without paying.
On testnet this is acceptable — all funds are faucet USDC.

**Production path:** Circle Nanopayments API handles full EIP-3009 validation
server-side, including signature verification and replay protection. Swap
`validateNanopayment()` in `lib/circle.ts` for the Circle Nanopayments API call.

## Stack

- **Runtime:** Node.js 22+ / Next.js 14 App Router
- **Payments:** Circle Developer-Controlled Wallets SDK
- **LLM:** OpenRouter (all models via single API key)
- **DB:** SQLite via `better-sqlite3`
- **Chain:** Arc Testnet (USDC as gas token)
