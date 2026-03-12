# InferPay — Pay-per-Inference Hub on Arc Testnet

AI proxy that accepts USDC nanopayments via Circle Nanopayments (x402 standard) for each LLM inference request. Arc Testnet, no custom smart contracts.

## Tech Stack

- Runtime: Node.js 22+
- Framework: Next.js 14 (App Router)
- Language: TypeScript (strict mode)
- Circle SDK: `@circle-fin/developer-controlled-wallets`
- LLM Proxy: OpenRouter API (single key, all models)
- DB: SQLite via `better-sqlite3` (transaction logs only)
- Chain: Arc Testnet (USDC as gas)
- Styling: Tailwind CSS (minimal playground UI)

## Key Directories

```
inferpay/
├── app/
│   ├── api/v1/chat/completions/  # x402 proxy endpoint
│   ├── api/health/               # healthcheck
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

## Architecture: x402 Payment Flow

1. Buyer sends POST to `/api/v1/chat/completions` (OpenAI-compatible body)
2. No `X-Payment` header → return `402 Payment Required` with price, payTo, chain
3. Buyer signs EIP-3009 authorization for the amount
4. Buyer retries with `X-Payment: <signed_auth>` header
5. Server validates via Circle Nanopayments API → ledger adjusted instantly
6. Server proxies to OpenRouter → streams LLM response back
7. Transaction logged to SQLite

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

## Circle SDK Patterns

IMPORTANT: Circle Developer-Controlled Wallets SDK requires:
1. Entity Secret registered first (`crypto.randomBytes(32).toString("hex")`)
2. Wallet Set created before any Wallet
3. Blockchain param is `"ARC-TESTNET"` (exact string)
4. USDC token on Arc Testnet has a specific token ID — get from Circle docs or faucet response
5. All wallet operations are async and may need polling for completion

```typescript
// Correct Circle SDK init pattern:
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});
```

## x402 / Nanopayments Patterns

- Nanopayments use EIP-3009 `transferWithAuthorization` signatures
- Payment validation is done via Circle Nanopayments API (off-chain), NOT on-chain tx verification
- Settlement happens in batches later — merchant gets instant confirmation
- The x402 standard: HTTP 402 status → client signs → client retries with payment header
- If Nanopayments API is unavailable: FALLBACK to direct USDC transfer via Dev-Controlled Wallets

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

## Domain Terms

- **Nanopayments**: Circle's gas-free USDC micro-transfer system via batched settlement
- **x402**: Open HTTP payment standard using 402 status code (by Coinbase, adopted by Circle)
- **EIP-3009**: Ethereum standard for `transferWithAuthorization` — signed off-chain, executed on-chain
- **Gateway Wallet**: Circle-managed wallet that holds USDC for nanopayment authorization
- **Dev-Controlled Wallet**: Server-side wallet managed via Circle SDK (our merchant wallet)
- **Arc Testnet**: Circle's L1 blockchain testnet, USDC as native gas token
- **Merchant**: Our proxy server that sells inference for USDC
- **Buyer**: AI agent or user that pays for inference

## Docs & References

- Circle Dev Wallet Quickstart: https://developers.circle.com/wallets/dev-controlled/create-your-first-wallet
- Circle Nanopayments: https://www.circle.com/nanopayments
- x402 Standard: https://docs.x402.org/introduction
- Arc Commerce Sample: https://github.com/circlefin/arc-commerce
- Arc Testnet Explorer: https://testnet.arcscan.app
- OpenRouter API: https://openrouter.ai/docs
- Circle Faucet: https://faucet.circle.com
