# InferPay

**Pay-per-inference proxy on Arc Testnet. AI agents pay USDC per LLM request via the x402 protocol. No API keys. No accounts. No subscriptions.**

**Live:** [ipayx402.xyz](https://ipayx402.xyz) · **Landing:** [ipayx402.xyz/landing](https://ipayx402.xyz/landing)

```bash
# Try it right now — no wallet needed
curl -X POST https://ipayx402.xyz/api/v1/demo/try \
  -H "Content-Type: application/json" \
  -d '{"model":"meta-llama/llama-3.1-70b-instruct","messages":[{"role":"user","content":"What is x402?"}]}'
```

---

## Why

AI agents are becoming economic actors. ~40,000 onchain agents are active today, but every one of them needs someone to register an account, enter a credit card, and generate an API key before they can call an LLM.

InferPay removes all of that. Money is the API key.

| Today | InferPay |
|-------|----------|
| Register account on OpenAI/Anthropic | Not needed |
| Add credit card | Not needed |
| Generate API key | Not needed |
| Manage billing/quotas | Not needed |
| Agent sends USDC → gets inference | ✅ |

---

## How It Works

```
Agent (Buyer)                         InferPay (Merchant)
     │                                       │
     │  POST /api/v1/chat/completions        │
     │  (no payment header)                  │
     │ ────────────────────────────────────►  │
     │                                       │
     │  402 Payment Required                 │
     │  PAYMENT-REQUIRED: <base64 JSON>      │
     │  { x402Version:2, accepts[], ... }    │
     │  ◄────────────────────────────────────│
     │                                       │
     │  Same request + Payment-Signature     │
     │  (EIP-3009 signed USDC transfer)      │
     │ ────────────────────────────────────►  │
     │                                       │
     │           ┌───────────────────┐       │
     │           │ Verify via Circle │       │
     │           │ Gateway API       │       │
     │           │ Settle (batched)  │       │
     │           │ Proxy to LLM      │       │
     │           │ Log transaction   │       │
     │           └───────────────────┘       │
     │                                       │
     │  200 OK + LLM response                │
     │  PAYMENT-RESPONSE: <base64 JSON>      │
     │  ◄────────────────────────────────────│
```

### Architecture

```
Production flow (Circle Nanopayments — permissionless):
  POST /api/v1/chat/completions
    ├─ no Payment-Signature  → 402 + x402 v2 requirements (PAYMENT-REQUIRED header)
    └─ Payment-Signature: <base64-encoded EIP-3009 payload>
         ├─ BatchFacilitatorClient.verify()   → cryptographic validation via Circle Gateway API
         ├─ BatchFacilitatorClient.settle()   → batched settlement (gas-free, instant confirmation)
         ├─ proxyToOpenRouter()               → LLM response
         └─ insertTransaction()               → SQLite log

Demo flow (no wallet needed):
  POST /api/v1/demo/try
    ├─ rate limit (5 req/min/IP)
    ├─ show 402 challenge step
    ├─ GatewayClient.pay()  → full 402 → sign EIP-3009 → settle flow with pre-funded wallet
    ├─ proxyToOpenRouter()  → LLM response
    └─ return { steps[], llm_response, tx_hash, mode: "demo" }
```

### Payment Stack

- **Seller (server):** `@circle-fin/x402-batching/server` — `BatchFacilitatorClient` for verify + settle
- **Buyer (agent):** `@circle-fin/x402-batching/client` — `GatewayClient` for deposit + pay
- **Protocol:** x402 v2 — HTTP 402 with EIP-3009 offchain signatures, zero gas
- **Settlement:** Batched by Circle Gateway — instant confirmation, settled onchain in bulk

---

## Three Ways to Use InferPay

### 1. Try Now — Zero Setup

Use the live demo. No wallet, no Circle account. A pre-funded testnet GatewayClient pays via real Circle Nanopayments so you can see the full x402 v2 flow.

```bash
curl -X POST https://ipayx402.xyz/api/v1/demo/try \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/llama-3.1-70b-instruct",
    "messages": [{"role": "user", "content": "What is x402?"}]
  }'
```

Rate limit: 5 requests/minute per IP. Or use the interactive demo at [ipayx402.xyz/landing](https://ipayx402.xyz/landing).

### 2. Buyer Agent — 5 Minute Setup

Clone the repo and run the autonomous buyer agent. Needs an EOA private key and testnet USDC deposited to the Circle Gateway.

```bash
git clone https://github.com/memevestor/inferpay.git
cd inferpay
cp .env.example .env.local
# Fill in BUYER_PRIVATE_KEY and OPENROUTER_API_KEY

npm install

# Deposit USDC to Circle Gateway (one-time)
# Get testnet USDC at https://faucet.circle.com (Arc Testnet)
# Then deposit from your EOA to Gateway:
npx tsx agent/buyer-v2.ts  # auto-deposits 10 USDC if Gateway balance is 0

# Run 5 paid inference requests:
npx tsx agent/buyer-v2.ts
```

### 3. Raw API — Build Your Own Client

Full control over the x402 v2 payment flow using `GatewayClient` from `@circle-fin/x402-batching`:

```typescript
import { GatewayClient } from "@circle-fin/x402-batching/client";

const buyer = new GatewayClient({
  chain: "arcTestnet",
  privateKey: "0x...",  // EOA private key
});

// One-time: deposit USDC to Circle Gateway
await buyer.deposit("10.0");

// Pay for inference (handles full 402 → sign → retry automatically)
const result = await buyer.pay("https://ipayx402.xyz/api/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "meta-llama/llama-3.1-70b-instruct",
    messages: [{ role: "user", content: "Hello from my agent!" }],
  }),
});

console.log(result.data);           // OpenAI-format response
console.log(result.transaction);    // Circle Gateway settlement UUID
```

---

## Who Is This For

InferPay is an **API for AI agents**, not a consumer app.

Your users are scripts and autonomous agents, not people clicking buttons. The Playground UI and demo exist to visualize the x402 flow — the real interface is the HTTP endpoint.

Example consumers:

- **Autonomous AI agents** (LangChain, CrewAI, AutoGPT) that need LLM access without human setup
- **MCP servers** that call LLMs as tools within agent workflows
- **Agent swarms** where one agent buys inference from another
- **Any software** that can use `@circle-fin/x402-batching/client` or implement x402 v2

---

## Supported Models

| Model | Price per request |
|-------|-----------------|
| meta-llama/llama-3.1-70b-instruct | 0.001 USDC |
| anthropic/claude-sonnet-4.6 | 0.005 USDC |
| openai/gpt-4o | 0.008 USDC |

Pricing is flat per request. Prices are testnet/decorative — USDC is faucet-funded.

---

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/chat/completions` | POST | Payment-Signature header | Production x402 v2 proxy |
| `/api/v1/demo/try` | POST | None (rate limited 5/min) | Demo flow with pre-funded GatewayClient |
| `/api/v1/demo/balance` | GET | None | Demo buyer wallet + gateway balance |
| `/api/transactions` | GET | `x-admin-token` header | Recent transaction log (admin only) |
| `/api/balance` | GET | None | Merchant wallet + gateway balance |
| `/api/health` | GET | None | Health check |

---

## Quick Start (Self-Hosted)

### Prerequisites

- Node.js 22+
- [Circle Developer Account](https://console.circle.com) + API key (for merchant server-side verification)
- [OpenRouter API key](https://openrouter.ai)
- An EOA private key with testnet USDC for the buyer agent

### 1. Clone & Install

```bash
git clone https://github.com/memevestor/inferpay.git
cd inferpay
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
# Edit .env.local — see Environment Variables section below
```

### 3. Run

```bash
npm run dev                    # Development: http://localhost:3000
npm run build && npm start     # Production
```

### 4. Verify

```bash
# x402 flow returns 402 with PAYMENT-REQUIRED header:
curl -si -X POST http://localhost:3000/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"meta-llama/llama-3.1-70b-instruct","messages":[{"role":"user","content":"ping"}]}' \
  | head -20
# Expected: HTTP/1.1 402, PAYMENT-REQUIRED: <base64>...

# Demo flow works:
curl -s http://localhost:3000/api/v1/demo/try \
  -H "Content-Type: application/json" \
  -d '{"model":"meta-llama/llama-3.1-70b-instruct","messages":[{"role":"user","content":"ping"}]}' \
  | jq .mode
# Expected: "demo"

# Buyer agent runs 5 paid requests:
npx tsx agent/buyer-v2.ts
```

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 22+ |
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Payments (seller) | `@circle-fin/x402-batching/server` — BatchFacilitatorClient |
| Payments (buyer) | `@circle-fin/x402-batching/client` — GatewayClient |
| LLM Proxy | OpenRouter API |
| Database | SQLite via `node:sqlite` (Node 22 native) |
| Chain | Arc Testnet (chainId 5042002, USDC 6 decimals) |
| Process Manager | PM2 |
| UI | Tailwind CSS |

---

## Project Structure

```
inferpay/
├── app/
│   ├── api/v1/
│   │   ├── chat/completions/    Production x402 v2 proxy
│   │   └── demo/
│   │       ├── try/             Demo flow (GatewayClient buyer)
│   │       └── balance/         Demo buyer balances
│   ├── api/transactions/        Transaction log (admin token required)
│   ├── api/balance/             Merchant balance
│   ├── api/health/              Health check
│   ├── landing/                 Landing page
│   ├── components/landing/      Landing page components
│   └── page.tsx                 Playground UI
├── lib/
│   ├── nanopay.ts               x402 v2: buildPaymentRequirements, verify, settle, extractPaymentHeader
│   ├── pricing.ts               MODEL_PRICES, getPriceForModel
│   ├── llm.ts                   proxyToOpenRouter
│   ├── db.ts                    SQLite: insertTransaction, listTransactions
│   └── rate-limit.ts            In-memory rate limiter
├── agent/
│   └── buyer-v2.ts              Autonomous GatewayClient buyer agent (5 paid requests)
├── scripts/
│   ├── check-balance.ts         Check Gateway/wallet balance
│   └── test-nanopay.ts          Quick payment test
├── CLAUDE.md                    Claude Code project config
└── README.md
```

---

## Environment Variables

```bash
# .env.local

# Circle — merchant server-side verification
CIRCLE_API_KEY=                    # From https://console.circle.com
CIRCLE_ENTITY_SECRET=              # Generated in Circle console
CIRCLE_WALLET_ADDRESS=             # Merchant address (Arc Testnet) — public, payTo address

# OpenRouter
OPENROUTER_API_KEY=                # From https://openrouter.ai

# Database
DATABASE_PATH=./data/inferpay.db

# Buyer agent (EOA private key — NOT a Circle Entity Secret)
BUYER_PRIVATE_KEY=0x...            # Any EOA with USDC deposited to Circle Gateway

# Demo endpoint (same format as BUYER_PRIVATE_KEY)
DEMO_BUYER_PRIVATE_KEY=0x...       # Pre-funded EOA for /api/v1/demo/try

# Admin token for /api/transactions
ADMIN_TOKEN=                       # Random 32-byte hex — set via: openssl rand -hex 32

# Optional: override internal URL for demo self-requests (default: http://localhost:3000)
# INFERPAY_INTERNAL_URL=http://localhost:3000
```

---

## Security

InferPay uses **Circle Nanopayments (x402 v2)** — full cryptographic payment verification, not just header parsing.

**Every payment is validated by:**

- **EIP-3009 signature** — `transferWithAuthorization` signed offchain by buyer's EOA, verified via Circle Gateway API (ecrecover)
- **Replay protection** — Gateway tracks nonces; `nonce_already_used` error on reuse
- **Amount validation** — must match exact model price (6 decimal USDC via bigint math)
- **Recipient validation** — must match `CIRCLE_WALLET_ADDRESS`
- **Time validation** — `validBefore` must be in the future

**Additional protections:**

- IP rate limiting: 60 req/min on production endpoint, 5 req/min on demo
- Model whitelist: unknown models rejected with 400
- `/api/transactions` requires `x-admin-token` header
- UFW firewall on VPS: only ports 22, 80, 443 open
- SSH: key-only auth, password auth disabled

**Demo mode:** `/api/v1/demo/try` uses a pre-funded `GatewayClient` (real EOA). The demo runs the complete x402 v2 flow — not a simulation. Rate limited to 5 requests/minute.

---

## Pricing Model (MVP)

Flat rate per request, regardless of token count.

**Production pricing approaches for v1.0:**

| Approach | How | Tradeoff |
|----------|-----|----------|
| Tiered flat rate | Price based on `max_tokens` in request | Simple but overpays on short responses |
| Prepaid balance | Agent deposits USDC, charged by actual tokens | Fair pricing but requires account state |
| Estimate + refund | Charge max, refund difference via Nanopayment | Fair for both sides, two tx per request |

---

## Known Limitations

- **Testnet only** — Arc Testnet, faucet USDC, not production-ready
- **In-memory rate limiter** — resets on PM2 restart; acceptable for MVP
- **Flat pricing** — no token-based billing yet
- **No streaming** — LLM responses returned in full, not streamed
- **Demo wallet drain** — sustained abuse at rate limit could deplete Gateway balance

---

## Roadmap

| Version | Scope |
|---------|-------|
| **v0.1** | x402 proxy · buyer agent · playground UI · demo mode · landing page |
| **v0.2 (current)** | Circle Nanopayments (x402 v2) · GatewayClient buyer · BatchFacilitatorClient seller · full EIP-3009 crypto verification · security hardening |
| v0.3 | Token-based pricing · usage dashboard · multi-model routing |
| v0.4 | Agent-to-agent marketplace (agents sell their skills for USDC) |
| v1.0 | Mainnet deployment · production security · real economics |

---

## Built With

- [Arc Testnet](https://arc.network) — Circle's L1 blockchain, USDC as native gas, chainId 5042002
- [Circle Nanopayments](https://developers.circle.com/gateway/nanopayments) — Gas-free micro-transfers via `@circle-fin/x402-batching`
- [x402 Standard](https://docs.x402.org) — Open HTTP payment protocol using 402 status code
- [OpenRouter](https://openrouter.ai) — Multi-model LLM API gateway

---

## License

MIT
