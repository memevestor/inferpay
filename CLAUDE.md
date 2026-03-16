# InferPay — Pay-per-Inference Hub on Arc Testnet

AI proxy that accepts USDC nanopayments via Circle Nanopayments (x402 standard) for each LLM inference request. Arc Testnet, no custom smart contracts.

**Production URL:** https://ipayx402.xyz/
- Playground UI: https://ipayx402.xyz/
- Landing page: https://ipayx402.xyz/landing (owned by separate agent)
- API endpoint: https://ipayx402.xyz/api/v1/chat/completions

## Tech Stack

- Runtime: Node.js 22+
- Framework: Next.js 14 (App Router)
- Language: TypeScript (strict mode)
- Nanopayments: `@circle-fin/x402-batching` (seller: verify/settle, buyer: GatewayClient)
- Circle SDK: `@circle-fin/developer-controlled-wallets` (demo endpoint only, legacy)
- LLM Proxy: OpenRouter API (single key, all models)
- DB: SQLite via `node:sqlite` (Node 22 native), WAL mode
- Chain: Arc Testnet (chainId: 5042002, CAIP-2: eip155:5042002, USDC 6 decimals)
- Styling: Tailwind CSS

## Key Directories

```
inferpay/
├── app/
│   ├── api/v1/chat/completions/  # x402 proxy endpoint
│   ├── api/health/               # healthcheck
│   ├── landing/                  # Landing page (SEPARATE AGENT — do not touch)
│   │   ├── page.tsx
│   │   └── CLAUDE.md             # Scoped instructions for landing agent
│   ├── components/landing/       # Landing components (SEPARATE AGENT — do not touch)
│   └── page.tsx                  # playground UI
├── lib/
│   ├── circle.ts                 # Circle SDK init, wallet ops, payment validation
│   ├── nanopay.ts                # x402 flow: 402 response, EIP-3009 validation
│   ├── pricing.ts                # model → price mapping
│   ├── llm.ts                    # OpenRouter proxy logic
│   └── db.ts                     # SQLite schema + queries
├── agent/
│   ├── buyer.ts                  # Demo buyer agent (autonomous)
│   └── signer.ts                 # EIP-3009 signature helper
├── scripts/
│   └── setup.sh                  # One-click: create wallet, get faucet USDC
├── CLAUDE.md
└── .env.local                    # Never commit
```

## Commands

```bash
npm run dev          # Start Next.js dev server on port 3000
npm run build        # Production build
npm run lint         # ESLint + TypeScript check
npm run test         # Run vitest
npm run setup        # Create Circle wallet + fund from faucet

# Test the proxy manually:
curl -X POST http://localhost:3000/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"meta-llama/llama-3.1-70b-instruct","messages":[{"role":"user","content":"hello"}]}'
# Expected: 402 Payment Required with x402 payment instructions

# Run demo buyer agent:
npx tsx agent/buyer.ts
```

## Environment Variables (.env.local)

```
CIRCLE_API_KEY=           # From https://console.circle.com
CIRCLE_ENTITY_SECRET=     # Generated during setup
CIRCLE_WALLET_ADDRESS=    # Merchant wallet on ARC-TESTNET
CIRCLE_WALLET_BLOCKCHAIN=ARC-TESTNET
OPENROUTER_API_KEY=       # From https://openrouter.ai
DATABASE_PATH=./data/inferpay.db
```

## Architecture: x402 Payment Flow (Nanopayments v0.2)

Two payment paths:

**Production (Nanopayments — permissionless):**
1. Buyer sends POST to `/api/v1/chat/completions` (OpenAI-compatible body)
2. No payment header → return `402` with x402Version:2, accepts[], extra.name="GatewayWalletBatched"
3. Buyer signs EIP-3009 authorization offchain (via GatewayClient SDK)
4. Buyer retries with signed payment header
5. Server calls `BatchFacilitatorClient.verify()` → crypto verification via Gateway API
6. Server calls `BatchFacilitatorClient.settle()` → batched settlement (gas-free)
7. Server proxies to OpenRouter → returns LLM response
8. Transaction logged to SQLite with settlement_type="batched"

**Demo (Direct transfer — our wallets):**
1. POST to `/api/v1/demo/try` → no wallet needed
2. Server uses pre-funded Demo Buyer wallet (Dev-Controlled Wallets)
3. Direct USDC transfer via Circle SDK
4. Same LLM proxy flow
5. Transaction logged with settlement_type="demo"

## Coding Conventions

- Named exports only, no default exports (except Next.js pages/routes)
- Use `unknown` + type narrowing, never `any`
- Error handling: return `{ ok, data, error }` result objects, not try/catch in business logic
- Wrap Circle SDK calls in try/catch at the boundary layer only (`lib/circle.ts`)
- All prices in string format (USDC decimals), never float arithmetic
- Use `bigint` for any onchain amounts
- Comments only for WHY, never for WHAT
- No barrel files (index.ts re-exports)
- Imports: absolute paths via `@/` alias

## Nanopayments SDK Patterns

IMPORTANT: Two SDKs in this project:
1. `@circle-fin/x402-batching` — Nanopayments (production payment path)
2. `@circle-fin/developer-controlled-wallets` — Legacy (demo endpoint only)

**Seller (our server) — verify and settle:**

```typescript
import { BatchFacilitatorClient } from "@circle-fin/x402-batching/server";

const facilitator = new BatchFacilitatorClient();

// Verify: crypto check via Gateway API (instant, no gas)
const verify = await facilitator.verify(paymentPayload, paymentRequirements);
// → { isValid: boolean, invalidReason?: string, payer?: string }

// Settle: submit to batch queue (instant confirmation, settled later)
const settle = await facilitator.settle(paymentPayload, paymentRequirements);
// → { success: boolean, transaction: string, payer?: string }
```

**Buyer (agent) — pay for resource:**

```typescript
import { GatewayClient } from "@circle-fin/x402-batching/client";

const buyer = new GatewayClient({
  chain: "arcTestnet",
  privateKey: "0x...",  // EOA private key, NOT Circle Entity Secret
});

await buyer.deposit("10.0");  // one-time Gateway deposit
const result = await buyer.pay(url, fetchOptions);
// Handles full 402 → sign → retry flow automatically
```

**402 response MUST include:**
- `x402Version: 2`
- `accepts[].extra.name = "GatewayWalletBatched"`
- `accepts[].extra.verifyingContract` — from CHAIN_CONFIGS
Without these, buyer SDK won't recognize it as Nanopayments endpoint.

## Circle Dev-Controlled Wallets (LEGACY — demo only)

Used ONLY in `/api/v1/demo/try` for the pre-funded demo flow. Do not use for production payment path.

```typescript
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});
```

## x402 / Nanopayments Flow

- Production payment path uses `@circle-fin/x402-batching` SDK — NOT custom parsing
- Buyer signs EIP-3009 `transferWithAuthorization` offchain (zero gas)
- Server verifies via `BatchFacilitatorClient.verify()` — full crypto check by Gateway API
- Server settles via `BatchFacilitatorClient.settle()` — batched, gas-free
- Settlement happens in bulk onchain later — seller gets instant confirmation
- Replay protection: Gateway checks nonce — `nonce_already_used` error on replay
- If Nanopayments SDK unavailable: demo endpoint falls back to Dev-Controlled Wallets (direct transfer)

## Pricing (lib/pricing.ts)

```typescript
// Testnet prices are decorative. Structure matters, not values.
export const MODEL_PRICES: Record<string, string> = {
  "meta-llama/llama-3.1-70b-instruct": "0.001",
  "anthropic/claude-sonnet-4.6": "0.005",
  "openai/gpt-4o": "0.008",
  "anthropic/claude-opus-4.6": "0.01",
};
```

## Testing

- Use `vitest` for unit tests
- Test files colocated: `lib/pricing.test.ts` next to `lib/pricing.ts`
- Mock Circle SDK in tests — never call real API in test suite
- Integration test for x402 flow: send request → get 402 → send payment → get 200

## Avoid

- No custom smart contracts — use only Circle SDK primitives
- No Prisma/Drizzle — SQLite via `better-sqlite3` is sufficient
- No auth/login system — x402 payment IS the authentication
- No WebSocket for payment flow — HTTP only (x402 standard)
- No multi-chain support in MVP — Arc Testnet only
- No float math for money — strings or bigint only
- No `localStorage` or `sessionStorage` in UI components
- Do not modify `agent/` directory when working on server code and vice versa
- Do not modify `app/landing/` or `app/components/landing/` — owned by a separate agent with its own CLAUDE.md

## Domain Terms

- **Nanopayments**: Circle's gas-free USDC micro-transfer system via batched settlement, SDK: `@circle-fin/x402-batching`
- **x402**: Open HTTP payment standard using 402 status code (by Coinbase, adopted by Circle)
- **EIP-3009**: Ethereum standard for `transferWithAuthorization` — signed off-chain, verified by Gateway
- **Gateway Wallet**: Smart contract on each chain where buyers deposit USDC for nanopayments
- **BatchFacilitatorClient**: Server-side SDK class for verifying and settling payments
- **GatewayClient**: Buyer-side SDK class — handles deposit, pay, withdraw, getBalances
- **Dev-Controlled Wallet**: Server-side Circle wallet (legacy, used for demo endpoint only)
- **Arc Testnet**: Circle's L1 blockchain testnet, USDC as native gas token, chainId 5042002
- **Merchant/Seller**: Our proxy server that sells inference for USDC
- **Buyer**: AI agent or user that pays for inference via Gateway Wallet

## Docs & References

- Nanopayments SDK Reference: https://developers.circle.com/gateway/nanopayments/references/sdk
- Nanopayments Overview: https://developers.circle.com/gateway/nanopayments
- Buyer Quickstart: https://developers.circle.com/gateway/nanopayments/quickstarts/buyer
- Seller Quickstart: https://developers.circle.com/gateway/nanopayments/quickstarts/seller
- x402 Concept: https://developers.circle.com/gateway/nanopayments/concepts/x402
- Batched Settlement: https://developers.circle.com/gateway/nanopayments/concepts/batched-settlement
- Supported Networks: https://developers.circle.com/gateway/nanopayments/supported-networks
- x402 Standard (Coinbase): https://docs.x402.org/introduction
- Circle Dev Wallets (legacy): https://developers.circle.com/wallets/dev-controlled/create-your-first-wallet
- Arc Testnet Explorer: https://testnet.arcscan.app
- OpenRouter API: https://openrouter.ai/docs
- Circle Faucet: https://faucet.circle.com
