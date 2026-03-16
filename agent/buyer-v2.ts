// Autonomous buyer agent — pays for LLM inference via Circle Nanopayments (GatewayClient)
// Usage: BUYER_PRIVATE_KEY=0x... npx tsx agent/buyer-v2.ts
//
// Prerequisites:
//   1. Generate EOA key: node -e "console.log('0x'+require('crypto').randomBytes(32).toString('hex'))"
//   2. Fund wallet USDC: https://faucet.circle.com → Arc Testnet → paste your address
//   3. First run deposits USDC into Gateway automatically

import * as dotenv from "dotenv";
import { GatewayClient } from "@circle-fin/x402-batching/client";

dotenv.config({ path: ".env.local" });

const INFERPAY_URL = "https://ipayx402.xyz/api/v1/chat/completions";
const MODEL = "meta-llama/llama-3.1-70b-instruct";
const REQUESTS = 5;
const DEPOSIT_AMOUNT = "5.0"; // USDC — one-time Gateway deposit

const privateKey = process.env.BUYER_PRIVATE_KEY as `0x${string}` | undefined;
if (!privateKey) {
  console.error("BUYER_PRIVATE_KEY not set in .env.local");
  process.exit(1);
}

const buyer = new GatewayClient({ chain: "arcTestnet", privateKey });
console.log("Buyer address:", buyer.address);

// ── Check balances ───────────────────────────────────────────────────────────
const balances = await buyer.getBalances();
console.log("Wallet USDC:  ", balances.wallet.formatted);
console.log("Gateway USDC: ", balances.gateway.formattedAvailable, "(available)");

// ── One-time Gateway deposit if empty ───────────────────────────────────────
if (balances.gateway.available === 0n) {
  console.log(`\nGateway balance is 0 — depositing ${DEPOSIT_AMOUNT} USDC...`);
  const deposit = await buyer.deposit(DEPOSIT_AMOUNT);
  console.log("Deposit tx:   ", deposit.depositTxHash);
  console.log("Deposited:    ", deposit.formattedAmount, "USDC");
}

// ── Send paid inference requests ─────────────────────────────────────────────
const prompts = [
  "What is the x402 payment protocol?",
  "Explain Circle Nanopayments in one sentence.",
  "What is EIP-3009?",
  "What is Arc Testnet?",
  "What is a Gateway Wallet?",
];

let succeeded = 0;
let failed = 0;

for (let i = 0; i < REQUESTS; i++) {
  const prompt = prompts[i % prompts.length];
  console.log(`\n--- Request ${i + 1}/${REQUESTS} ---`);
  console.log("Prompt:", prompt);

  const result = await buyer.pay<{ choices: { message: { content: string } }[] }>(
    INFERPAY_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
      }),
    }
  );

  console.log("Status:", result.status);
  console.log("Paid:  ", result.formattedAmount, "USDC");
  console.log("Tx:    ", result.transaction);

  const content = result.data.choices?.[0]?.message?.content ?? "(no response)";
  console.log("Reply:", content.slice(0, 150) + (content.length > 150 ? "..." : ""));

  if (result.status === 200) {
    succeeded++;
  } else {
    failed++;
  }
}

// ── Final summary ────────────────────────────────────────────────────────────
const finalBalances = await buyer.getBalances();
console.log(`\n=== Summary: ${succeeded}/${REQUESTS} succeeded, ${failed} failed ===`);
console.log("Gateway USDC remaining:", finalBalances.gateway.formattedAvailable);
