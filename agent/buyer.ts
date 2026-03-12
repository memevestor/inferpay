import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const PROXY_URL = "http://localhost:3000/api/v1/chat/completions";
const MODEL = "meta-llama/llama-3.1-70b-instruct";

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});

type PaymentRequired = {
  version: number;
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  memo?: string;
};

// Builds X-Payment header by creating a real Circle USDC transfer and encoding
// the authorization as base64 JSON for the proxy to validate.
async function signPayment(paymentInfo: PaymentRequired): Promise<string> {
  // Arc Testnet USDC: 6 decimals (confirmed via arcscan.app, Circle SDK reports wrong value)
  const amountUnits = BigInt(Math.round(parseFloat(paymentInfo.amount) * 1_000_000));

  const transfer = await client.createTransaction({
    walletId: process.env.BUYER_WALLET_ID!,
    tokenId: process.env.USDC_TOKEN_ID!,
    destinationAddress: paymentInfo.payTo,
    amounts: [paymentInfo.amount],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });

  const txId = transfer.data?.id ?? "";
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    from: process.env.BUYER_WALLET_ADDRESS!,
    to: paymentInfo.payTo,
    value: amountUnits.toString(),
    validAfter: 0,
    validBefore: now + 3600,
    nonce: txId,
    txId,
  };

  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

async function sendInferenceRequest(prompt: string, attempt: number): Promise<void> {
  console.log(`\n🤖 Запрос #${attempt}: "${prompt}"`);

  // Step 1: send without payment — expect 402
  const res1 = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (res1.status !== 402) {
    console.log("⚠️ Ожидали 402, получили:", res1.status);
    return;
  }

  const paymentInfo: PaymentRequired = await res1.json();
  console.log(`💳 Payment required: ${paymentInfo.amount} ${paymentInfo.asset}`);

  // Step 2: sign via Circle Dev Wallet and retry
  const paymentHeader = await signPayment(paymentInfo);

  const res2 = await fetch(PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Payment": paymentHeader,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res2.ok) {
    const err = await res2.text();
    console.log(`❌ Ошибка ${res2.status}:`, err);
    return;
  }

  const result = await res2.json();
  const reply = (result.choices?.[0]?.message?.content ?? "(нет ответа)") as string;
  console.log("✅ LLM ответ:", reply.slice(0, 200));
  console.log(`💰 Потрачено: ${paymentInfo.amount} USDC`);
}

const prompts = [
  "What is DeFi?",
  "Explain liquidity pools",
  "What is impermanent loss?",
  "How does AMM work?",
  "What is a yield farm?",
  "Explain stablecoins",
  "What is TVL in DeFi?",
  "How do flash loans work?",
  "What is a DEX?",
  "Explain token bridges",
];

for (let i = 0; i < prompts.length; i++) {
  await sendInferenceRequest(prompts[i], i + 1);
  await new Promise((r) => setTimeout(r, 1000));
}
