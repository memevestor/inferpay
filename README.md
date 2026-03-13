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
     │  { amount, payTo, network, model }    │
     │  ◄────────────────────────────────────│
     │                                       │
     │  Same request + X-Payment header      │
     │  (signed USDC transfer)               │
     │ ────────────────────────────────────►  │
     │                                       │
     │           ┌───────────────────┐       │
     │           │ Validate payment  │       │
     │           │ Transfer USDC     │       │
     │           │ Proxy to LLM     │       │
     │           │ Log transaction   │       │
     │           └───────────────────┘       │
     │                                       │
     │  200 OK + LLM response               │
     │  ◄────────────────────────────────────│
```

### Architecture

```
Production flow:
  POST /api/v1/chat/completions
    ├─ no X-Payment  → 402 + { amount, payTo, network }
    └─ X-Payment: <base64 JSON>
         ├─ validateNanopayment()  → parse header, check value/to/validBefore
         ├─ sendUsdcTransfer()     → real USDC transfer via Circle SDK
         ├─ proxyToOpenRouter()    → LLM response (Claude/GPT/Llama)
         └─ insertTransaction()    → SQLite log

Demo flow (no wallet needed):
  POST /api/v1/demo/try
    ├─ rate limit (5 req/min/IP)
    ├─ simulate 402 step
    ├─ sendUsdcTransfer(DEMO_BUYER → MERCHANT)  → real onchain USDC
    ├─ proxyToOpenRouter()  → LLM response
    └─ return { steps[], llm_response, tx_hash, mode: "demo" }
```

---

## Three Ways to Use InferPay

### 1. Try Now — Zero Setup

Use the live demo. No wallet, no Circle account. We pay from a pre-funded testnet wallet so you can see the full x402 flow with real onchain USDC transfers.

```bash
curl -X POST https://ipayx402.xyz/api/v1/demo/try \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/llama-3.1-70b-instruct",
    "messages": [{"role": "user", "content": "What is x402?"}]
  }'
```

Rate limit: 5 requests/minute. Or use the interactive demo at [ipayx402.xyz/landing](https://ipayx402.xyz/landing).

### 2. Buyer Agent — 5 Minute Setup

Clone the repo and run the autonomous buyer agent. Needs a Circle API key and testnet USDC.

```bash
git clone https://github.com/memevestor/inferpay.git
cd inferpay
cp .env.example .env.local
# Fill in CIRCLE_API_KEY and OPENROUTER_API_KEY

npm install
npm run setup    # Creates wallet, prompts for faucet funding
npx tsx agent/buyer.ts  # Sends 10 paid requests automatically
```

### 3. Raw API — Build Your Own Client

Full control over the x402 payment flow. See [docs/INTEGRATION_GUIDE.md](docs/INTEGRATION_GUIDE.md) for TypeScript and Python examples.

```bash
# Step 1: Get price
curl -s -X POST https://ipayx402.xyz/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"meta-llama/llama-3.1-70b-instruct","messages":[{"role":"user","content":"hi"}]}'
# → 402 { amount: "1000", payTo: "0x681d...6140" }

# Step 2: Build payment and retry
PAYMENT=$(echo -n '{"from":"YOUR_WALLET","to":"0x681d...6140","value":"1000","nonce":"1"}' | base64)

curl -s -X POST https://ipayx402.xyz/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-Payment: $PAYMENT" \
  -d '{"model":"meta-llama/llama-3.1-70b-instruct","messages":[{"role":"user","content":"hi"}]}'
# → 200 + LLM response
```

---

## Who Is This For

InferPay is an **API for AI agents**, not a consumer app.

Your users are scripts and autonomous agents, not people clicking buttons. The Playground UI and demo exist to visualize the x402 flow — the real interface is the HTTP endpoint.

Example consumers:

- **Autonomous AI agents** (LangChain, CrewAI, AutoGPT) that need LLM access without human setup
- **MCP servers** that call LLMs as tools within agent workflows
- **Agent swarms** where one agent buys inference from another
- **Any software** that can sign a USDC transfer and send an HTTP request

---

## Supported Models

| Model | Price per request | `amount` in header |
|-------|------------------|--------------------|
| meta-llama/llama-3.1-70b-instruct | 0.001 USDC | 1000 |
| anthropic/claude-sonnet-4.6 | 0.005 USDC | 5000 |
| openai/gpt-4o | 0.008 USDC | 8000 |
| anthropic/claude-opus-4.6 | 0.01 USDC | 10000 |

`amount` = price × 10^6 (USDC has 6 decimals on Arc Testnet). Pricing is flat per request — see [Pricing Model](#pricing-model-mvp).

---

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/chat/completions` | POST | X-Payment header | Production x402 proxy |
| `/api/v1/demo/try` | POST | None (rate limited) | Demo flow with pre-funded wallet |
| `/api/v1/demo/config` | GET | None | Rate limit status + available models |
| `/api/v1/demo/balance` | GET | None | Demo buyer wallet balance |
| `/api/transactions` | GET | None | Recent transaction log |
| `/api/balance` | GET | None | Merchant wallet balance |

---

## Quick Start (Self-Hosted)

### Prerequisites

- Node.js 22+
- [Circle Developer Account](https://console.circle.com) + API key
- [OpenRouter API key](https://openrouter.ai)

### 1. Clone & Install

```bash
git clone https://github.com/memevestor/inferpay.git
cd inferpay
npm install
```

### 2. Setup Wallets

```bash
cp .env.example .env.local
# Fill in CIRCLE_API_KEY and OPENROUTER_API_KEY

npm run setup
# Creates merchant wallet on Arc Testnet
# Prompts you to fund via https://faucet.circle.com

# Optional: setup demo buyer wallet for /api/v1/demo/try
npx tsx scripts/setup-demo.ts
```

### 3. Run

```bash
npm run dev                    # Development: http://localhost:3000
npm run build && npm start     # Production
```

### 4. Verify

```bash
# x402 flow returns 402:
curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:3000/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"meta-llama/llama-3.1-70b-instruct","messages":[{"role":"user","content":"ping"}]}'
# Expected: 402

# Demo flow works:
curl -s http://localhost:3000/api/v1/demo/try \
  -H "Content-Type: application/json" \
  -d '{"model":"meta-llama/llama-3.1-70b-instruct","messages":[{"role":"user","content":"ping"}]}' | jq .mode
# Expected: "demo"

# Buyer agent completes 10 requests:
npx tsx agent/buyer.ts
# Expected: 10/10 successful
```

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 22+ |
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Payments | Circle Developer-Controlled Wallets SDK |
| LLM Proxy | OpenRouter API |
| Database | SQLite via `node:sqlite` (Node 22 native) |
| Chain | Arc Testnet (USDC as gas, 6 decimals) |
| Process Manager | PM2 |
| UI | Tailwind CSS |

---

## Project Structure

```
inferpay/
├── app/
│   ├── api/v1/
│   │   ├── chat/completions/    Production x402 proxy
│   │   └── demo/
│   │       ├── try/             Demo flow endpoint
│   │       ├── config/          Rate limit status
│   │       └── balance/         Demo buyer balance
│   ├── api/transactions/        Transaction log
│   ├── api/balance/             Merchant balance
│   ├── landing/                 Landing page
│   ├── components/landing/      Landing page components
│   └── page.tsx                 Playground UI
├── lib/
│   ├── circle.ts                Circle SDK: getBalance, sendUsdcTransfer, validateNanopayment
│   ├── nanopay.ts               x402: build402Response, payment header parsing
│   ├── pricing.ts               MODEL_PRICES, getPriceForModel
│   ├── llm.ts                   proxyToOpenRouter
│   ├── db.ts                    SQLite: insertTransaction, getRecentTransactions
│   └── rate-limit.ts            In-memory rate limiter (5 req/min/IP)
├── agent/
│   ├── buyer.ts                 Autonomous buyer agent (10 paid requests)
│   └── signer.ts                EIP-3009 payment signing helper
├── scripts/
│   ├── setup.sh                 Merchant wallet setup
│   └── setup-demo.ts            Demo buyer wallet setup
├── docs/
│   └── INTEGRATION_GUIDE.md     Full integration guide (curl/TS/Python)
├── CLAUDE.md                    Claude Code project config
└── README.md
```

---

## Environment Variables

```bash
# .env.local
CIRCLE_API_KEY=                    # Circle Developer Console
CIRCLE_ENTITY_SECRET=              # Generated during setup
CIRCLE_WALLET_ID=                  # Merchant wallet ID
CIRCLE_WALLET_ADDRESS=             # Merchant wallet address (Arc Testnet)
CIRCLE_WALLET_SET_ID=              # Wallet Set ID
USDC_TOKEN_ID=                     # USDC token ID on Arc Testnet
OPENROUTER_API_KEY=                # OpenRouter dashboard
DATABASE_PATH=./data/inferpay.db

# Demo mode (optional — required for /api/v1/demo/try)
DEMO_BUYER_WALLET_ID=              # Created via scripts/setup-demo.ts
DEMO_BUYER_WALLET_ADDRESS=         # Demo buyer address
```

---

## Security (Testnet MVP)

Payment validation uses base64 JSON parsing and Circle SDK transfer verification, not cryptographic EIP-3009 signature verification (`ecrecover`). This is a conscious tradeoff for MVP speed.

**Production path:** Circle Nanopayments API handles full EIP-3009 validation server-side with cryptographic guarantees, replay protection, and batched settlement.

**Current MVP validates:**

- Payment amount matches model price (6 decimal USDC math via `BigInt`)
- Recipient address matches merchant wallet
- `validBefore` timestamp is in the future
- USDC transfer completes via Circle SDK

**MVP does NOT validate:**

- Cryptographic signature (`ecrecover`)
- Replay protection (nonce deduplication)

**Demo mode:** The `/api/v1/demo/try` endpoint uses a pre-funded buyer wallet owned by InferPay. Transactions are real onchain USDC transfers on Arc Testnet, but the user does not connect their own wallet. Rate limited to 5 requests/minute per IP.

---

## Pricing Model (MVP)

Flat rate per request, regardless of token count. A "hello" and a 3000-word essay cost the same.

**Why this is acceptable for testnet MVP:** USDC is faucet-funded with no real value. The purpose is demonstrating the payment flow, not optimizing economics.

**Production pricing approaches:**

| Approach | How | Tradeoff |
|----------|-----|----------|
| Tiered flat rate | Price based on `max_tokens` in request | Simple but overpays on short responses |
| Prepaid balance | Agent deposits USDC, charged by actual tokens | Fair pricing but requires account state |
| Estimate + refund | Charge max, refund difference via Nanopayment | Fair for both sides, two tx per request |

---

## Known Limitations

- **Testnet only** — uses faucet USDC, not production-ready
- **Closed-loop payments** — only wallets created via the same Circle API key can use the production endpoint; external wallets require Nanopayments (v0.2) or ERC-20 approve flow
- **Demo wallet drain** — demo buyer wallet funded from faucet; sustained abuse at rate limit could deplete balance
- **tx_hash = Circle UUID** — not an onchain `0x...` hash; resolving the onchain hash requires polling `getTransaction()` after confirmation
- **No Nanopayments** — uses direct USDC transfers; Circle Nanopayments (gas-free, batched) planned for v0.2
- **No replay protection** — same signed payment could theoretically be reused
- **No streaming** — LLM responses returned in full, not streamed
- **Flat pricing** — no token-based billing yet

---

## Roadmap

| Version | Scope |
|---------|-------|
| **v0.1 (current)** | x402 proxy · buyer agent · playground UI · demo mode · landing page |
| v0.2 | Circle Nanopayments integration (gas-free, batched, permissionless) |
| v0.3 | Token-based pricing · usage dashboard · multi-model routing |
| v0.4 | Agent-to-agent marketplace (agents sell their skills for USDC) |
| v1.0 | Mainnet deployment · production security · real economics |

---

## Built With

- [Arc](https://arc.network) — Circle's L1 blockchain, USDC as native gas, sub-second finality
- [Circle Developer Platform](https://developers.circle.com) — Developer-Controlled Wallets, USDC transfers
- [Circle Nanopayments](https://www.circle.com/nanopayments) — Gas-free micro-transfers (testnet, integration planned)
- [x402 Standard](https://docs.x402.org) — Open HTTP payment protocol using 402 status code
- [OpenRouter](https://openrouter.ai) — Multi-model LLM API gateway

---

## License

MIT
