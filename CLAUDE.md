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
│   ├── api/v1/chat/completions/  # x402 v2 proxy endpoint (production)
│   ├── api/v1/demo/try/          # Demo endpoint (GatewayClient buyer)
│   ├── api/v1/demo/balance/      # Demo buyer balances
│   ├── api/transactions/         # Public transaction log (read-only, no auth)
│   ├── api/balance/              # Merchant balance
│   ├── api/health/               # healthcheck
│   ├── landing/                  # Landing page (SEPARATE AGENT — do not touch)
│   │   ├── page.tsx
│   │   └── CLAUDE.md             # Scoped instructions for landing agent
│   ├── components/landing/       # Landing components (SEPARATE AGENT — do not touch)
│   └── page.tsx                  # playground UI
├── lib/
│   ├── nanopay.ts                # x402 v2: buildPaymentRequirements, verify, settle, extractPaymentHeader
│   ├── pricing.ts                # model → price mapping
│   ├── llm.ts                    # OpenRouter proxy logic
│   ├── db.ts                     # SQLite schema + queries
│   └── rate-limit.ts             # In-memory rate limiter
├── agent/
│   └── buyer-v2.ts               # Autonomous GatewayClient buyer (5 paid requests)
├── scripts/
│   ├── check-balance.ts          # Check Gateway/wallet balances
│   └── test-nanopay.ts           # Quick payment test
├── CLAUDE.md
└── .env.local                    # Never commit
```

## Commands

```bash
npm run dev          # Start Next.js dev server on port 3000
npm run build        # Production build
npm run lint         # ESLint + TypeScript check
npm run test         # Run vitest

# Test the proxy manually:
curl -si -X POST http://localhost:3000/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"meta-llama/llama-3.1-70b-instruct","messages":[{"role":"user","content":"hello"}]}'
# Expected: 402 with PAYMENT-REQUIRED header (base64 JSON)

# Run autonomous GatewayClient buyer agent (5 paid requests):
npx tsx agent/buyer-v2.ts

# Check admin transaction log:
curl -H "x-admin-token: $ADMIN_TOKEN" http://localhost:3000/api/transactions
```

## Environment Variables (.env.local)

```
CIRCLE_API_KEY=              # From https://console.circle.com
CIRCLE_ENTITY_SECRET=        # Generated in Circle console
CIRCLE_WALLET_ADDRESS=       # Merchant wallet address on Arc Testnet (public payTo address)
OPENROUTER_API_KEY=          # From https://openrouter.ai
DATABASE_PATH=./data/inferpay.db

BUYER_PRIVATE_KEY=0x...      # EOA private key for buyer agent (NOT Circle Entity Secret)
DEMO_BUYER_PRIVATE_KEY=0x... # EOA private key for /api/v1/demo/try (pre-funded Gateway)
ADMIN_TOKEN=                 # Random hex — protects /api/transactions endpoint

# Optional
INFERPAY_INTERNAL_URL=http://localhost:3000  # Internal URL for demo self-requests (default: http://localhost:3000)
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

**Demo (GatewayClient buyer — real x402 v2 flow):**
1. POST to `/api/v1/demo/try` → no wallet needed from user
2. Server uses pre-funded Demo Buyer EOA (`DEMO_BUYER_PRIVATE_KEY`)
3. `GatewayClient.pay()` runs full 402 → sign EIP-3009 → settle flow
4. Self-requests to `http://localhost:3000/api/v1/chat/completions` (via `INFERPAY_INTERNAL_URL`)
5. Returns `{ steps[], llm_response, tx_hash, mode: "demo" }`

## Coding Conventions

- Named exports only, no default exports (except Next.js pages/routes)
- Use `unknown` + type narrowing, never `any`
- Error handling: return `{ ok, data, error }` result objects, not try/catch in business logic
- Wrap Circle SDK calls in try/catch at the boundary layer only (`lib/nanopay.ts`)
- All prices in string format (USDC decimals), never float arithmetic
- Use `bigint` for any onchain amounts
- Comments only for WHY, never for WHAT
- No barrel files (index.ts re-exports)
- Imports: absolute paths via `@/` alias

## Nanopayments SDK Patterns

IMPORTANT: One SDK for payments:
1. `@circle-fin/x402-batching` — Nanopayments (both production and demo payment paths)

`@circle-fin/developer-controlled-wallets` is installed but NOT used for payments — it's a legacy dependency.

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

## x402 v2 / Nanopayments Flow

- Production payment path uses `@circle-fin/x402-batching` SDK — NOT custom parsing
- Buyer signs EIP-3009 `transferWithAuthorization` offchain (zero gas)
- Server verifies via `BatchFacilitatorClient.verify()` — full crypto check by Gateway API
- Server settles via `BatchFacilitatorClient.settle()` — batched, gas-free
- Settlement happens in bulk onchain later — seller gets instant confirmation
- Replay protection: Gateway checks nonce — `nonce_already_used` error on replay
- Demo endpoint uses `GatewayClient.pay()` — same SDK, same x402 v2 flow, just a pre-funded EOA

## Pricing (lib/pricing.ts)

```typescript
// Testnet prices are decorative. Structure matters, not values.
export const MODEL_PRICES: Record<string, string> = {
  "meta-llama/llama-3.1-70b-instruct": "0.001",
  "anthropic/claude-sonnet-4.6": "0.005",
  "openai/gpt-4o": "0.008",
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

## Deploy

VPS is a **read-only mirror** of the `main` branch. All changes go through the local → GitHub → VPS pipeline. Never make edits directly on the server.

**5 rules:**
1. Never commit or edit files directly on the VPS — local machine only
2. One task = one deploy: build locally → verify → push to GitHub → pull on VPS → restart PM2
3. Always run `npm run build` locally before pushing — catch TypeScript errors before they hit production
4. After `pm2 restart`, verify with `curl https://ipayx402.xyz/api/health` — if not 200, check `pm2 logs inferpay --lines 50`
5. `.env.local` on VPS is the source of truth for secrets — never overwrite it during deploy (`.env.local` is gitignored)

**Deploy sequence:**
```bash
# Local:
npm run build          # must pass clean
git push

# VPS (ssh root@157.173.110.229):
cd /var/www/inferpay
git pull
npm run build
pm2 restart inferpay
```

---

## Security

Checks to run before every deploy and after any dependency update:

**Secrets / credentials:**
- `.env.local` must be in `.gitignore` — verify: `git check-ignore .env.local` must return the filename
- Scan for accidentally committed secrets: `git log --all --full-history -- .env.local` must be empty
- Never hardcode API keys, private keys, or passwords in source files — use `process.env.*` only
- `ADMIN_TOKEN`, `CIRCLE_API_KEY`, `CIRCLE_ENTITY_SECRET`, `DEMO_BUYER_PRIVATE_KEY` must NEVER appear in git history
- Check GitHub repo is private: Settings → Visibility. This project has VPS credentials in `.env.local`

**VPS open ports:**
- Only ports 22 (SSH), 80 (HTTP redirect), 443 (HTTPS) should be publicly accessible
- Verify: `ss -tlnp` on VPS — port 3000 (Next.js) must NOT be exposed externally (nginx proxies it)
- Check firewall: `ufw status` — should show only 22/80/443 allowed

**API surface:**
- `/api/transactions` is intentionally public (blockchain data) — only payer address, model, amount, tx hash. No private data
- `/api/v1/demo/try` is rate-limited (5 req/min per IP) — prevents demo wallet drain
- `/api/v1/chat/completions` is rate-limited (60 req/min per IP) — prevents spam on the 402 path
- No admin endpoints are publicly accessible without `ADMIN_TOKEN`

**Dependencies:**
- Run `npm audit` periodically — pay attention to high/critical severity in `@circle-fin/*` and `next`
- `DEMO_BUYER_PRIVATE_KEY` controls a real funded EOA — treat as a hot wallet secret

**WARNING section** — before any change, check if it:
- Exposes a new unauthenticated endpoint that could drain the demo wallet
- Adds a new `process.env.*` variable that might be logged or returned in error responses
- Modifies rate limiting — removing or weakening limits on payment endpoints is a security risk
- Changes the `settlePayment` / `verifyPayment` flow — any bypass here means free LLM calls

---

## Recent Changes

**2026-03-18 — Settlement tx hash resolution (submitBatch approach):**
- `lib/arcscan.ts` rewritten: instead of searching for ERC-20 token transfers (which don't exist in Circle Nanopayments), now queries the Gateway Wallet contract (`0x0077777...`) for `submitBatch()` transactions. The first `submitBatch` after a payment's timestamp IS the onchain settlement proof.
- `lookupSettlementTxHash(createdAt)` — waits 6 min then finds the batch. `resolvePendingHashes(pending)` — bulk-resolves all UUID hashes when `/api/transactions` is loaded.
- `/api/transactions` made public (removed `x-admin-token` requirement) — was causing empty Transactions Log in the UI.
- UI: removed misleading payer address link (showed unrelated old txs), added `⏳ settling` → `0x...↗` ArcScan link once hash resolves. Auto-polls every 30s.

---

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
