# InferPay Integration Guide

**For developers who already have a Circle Developer Account and testnet USDC on Arc.**

Production endpoint: `https://ipayx402.xyz/api/v1/chat/completions`

---

## Prerequisites

- Circle Developer Account with API key
- Developer-Controlled Wallet on Arc Testnet
- Testnet USDC balance > 0 (get from https://faucet.circle.com)
- Node.js 22+

---

## How x402 Works (2 requests)

```
Request 1:  POST /api/v1/chat/completions  (no payment)
Response 1: 402 { amount: "1000", payTo: "0x...", network: "ARC-TESTNET" }

Request 2:  POST /api/v1/chat/completions  (with X-Payment header)
Response 2: 200 { choices: [...], model: "...", inferpay: { tx_hash: "..." } }
```

---

## Step 1: Get the price (30 seconds)

Send a request without payment to see what's required:

```bash
curl -s -X POST https://ipayx402.xyz/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/llama-3.1-70b-instruct",
    "messages": [{"role": "user", "content": "hello"}]
  }' | jq .
```

Response (402):

```json
{
  "error": "Payment Required",
  "payment": {
    "amount": "1000",
    "currency": "USDC",
    "decimals": 6,
    "payTo": "0xMERCHANT_WALLET_ADDRESS",
    "network": "ARC-TESTNET",
    "model": "meta-llama/llama-3.1-70b-instruct",
    "price_usdc": "0.001000"
  }
}
```

`amount: "1000"` = 0.001 USDC × 10^6 decimals.

---

## Step 2: Build the X-Payment header

The X-Payment header is a base64-encoded JSON object:

```json
{
  "from": "0xYOUR_WALLET_ADDRESS",
  "to": "0xMERCHANT_ADDRESS_FROM_402",
  "value": "1000",
  "nonce": "1"
}
```

Encode it:

```bash
echo -n '{"from":"0xYOUR_WALLET","to":"0xMERCHANT","value":"1000","nonce":"1"}' | base64
```

---

## Step 3: Send paid request (30 seconds)

```bash
PAYMENT=$(echo -n '{"from":"0xYOUR_WALLET","to":"0xMERCHANT","value":"1000","nonce":"1"}' | base64)

curl -s -X POST https://ipayx402.xyz/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-Payment: $PAYMENT" \
  -d '{
    "model": "meta-llama/llama-3.1-70b-instruct",
    "messages": [{"role": "user", "content": "What is the x402 payment protocol?"}]
  }' | jq .
```

Response (200):

```json
{
  "id": "gen-xxx",
  "model": "meta-llama/llama-3.1-70b-instruct",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "The x402 protocol is..."
      }
    }
  ],
  "inferpay": {
    "tx_hash": "71b20a12-...",
    "price_usdc": "0.001000",
    "network": "ARC-TESTNET"
  }
}
```

---

## Full TypeScript Example

Complete working script. Requires: `npm install @circle-fin/developer-controlled-wallets`

```typescript
// test-inferpay.ts
// Usage: CIRCLE_API_KEY=xxx CIRCLE_ENTITY_SECRET=xxx npx tsx test-inferpay.ts

const INFERPAY_URL = "https://ipayx402.xyz/api/v1/chat/completions";

async function main() {
  // --- Step 1: Get price ---
  const priceRes = await fetch(INFERPAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "meta-llama/llama-3.1-70b-instruct",
      messages: [{ role: "user", content: "What is x402?" }],
    }),
  });

  if (priceRes.status !== 402) {
    throw new Error(`Expected 402, got ${priceRes.status}`);
  }

  const priceData = await priceRes.json();
  console.log("Price:", priceData.payment.price_usdc, "USDC");
  console.log("Pay to:", priceData.payment.payTo);

  // --- Step 2: Build payment ---
  // Replace with YOUR wallet address from Circle Developer Console
  const YOUR_WALLET = "0xYOUR_ARC_TESTNET_WALLET";

  const payment = {
    from: YOUR_WALLET,
    to: priceData.payment.payTo,
    value: priceData.payment.amount,
    nonce: Date.now().toString(),
  };

  const xPayment = btoa(JSON.stringify(payment));

  // --- Step 3: Send paid request ---
  const llmRes = await fetch(INFERPAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Payment": xPayment,
    },
    body: JSON.stringify({
      model: "meta-llama/llama-3.1-70b-instruct",
      messages: [{ role: "user", content: "What is x402?" }],
    }),
  });

  const llmData = await llmRes.json();
  console.log("\nStatus:", llmRes.status);
  console.log("Response:", llmData.choices?.[0]?.message?.content);
  console.log("Tx:", llmData.inferpay?.tx_hash);
}

main().catch(console.error);
```

Run:

```bash
npx tsx test-inferpay.ts
```

---

## Python Example

```python
# test_inferpay.py
# Usage: python test_inferpay.py

import requests
import json
import base64
import time

INFERPAY_URL = "https://ipayx402.xyz/api/v1/chat/completions"
YOUR_WALLET = "0xYOUR_ARC_TESTNET_WALLET"

body = {
    "model": "meta-llama/llama-3.1-70b-instruct",
    "messages": [{"role": "user", "content": "What is x402?"}]
}

# Step 1: Get price
r1 = requests.post(INFERPAY_URL, json=body)
assert r1.status_code == 402, f"Expected 402, got {r1.status_code}"

price_data = r1.json()
print(f"Price: {price_data['payment']['price_usdc']} USDC")
print(f"Pay to: {price_data['payment']['payTo']}")

# Step 2: Build payment
payment = {
    "from": YOUR_WALLET,
    "to": price_data["payment"]["payTo"],
    "value": price_data["payment"]["amount"],
    "nonce": str(int(time.time()))
}

x_payment = base64.b64encode(json.dumps(payment).encode()).decode()

# Step 3: Send paid request
r2 = requests.post(
    INFERPAY_URL,
    json=body,
    headers={"X-Payment": x_payment}
)

data = r2.json()
print(f"\nStatus: {r2.status_code}")
print(f"Response: {data['choices'][0]['message']['content'][:200]}...")
print(f"Tx: {data.get('inferpay', {}).get('tx_hash', 'N/A')}")
```

---

## Models & Pricing

| Model | Price (USDC) | `amount` in header |
|-------|-------------|-------------------|
| meta-llama/llama-3.1-70b-instruct | 0.001 | 1000 |
| anthropic/claude-sonnet-4.6 | 0.005 | 5000 |
| openai/gpt-4o | 0.008 | 8000 |
| anthropic/claude-opus-4.6 | 0.01 | 10000 |

`amount` = price × 10^6 (USDC has 6 decimals on Arc Testnet)

---

## Troubleshooting

**Got 402 even with X-Payment header?**
- Check that `value` matches the required `amount` from the 402 response
- Check that `to` matches `payTo` from the 402 response exactly
- Ensure your wallet has enough testnet USDC

**Got 500?**
- Your wallet may have insufficient balance for the USDC transfer
- The LLM upstream (OpenRouter) may be temporarily unavailable

**Where to get testnet USDC?**
- https://faucet.circle.com — select Arc Testnet, paste your wallet address

---

## Important Notes

- This is a **testnet MVP**. USDC is testnet tokens with no real value.
- Payment validation is simplified (no cryptographic EIP-3009 verification). See Security section in README.
- Flat rate per request regardless of token count. Token-based pricing planned for v0.2.
- `tx_hash` in response is a Circle UUID, not an onchain transaction hash.
