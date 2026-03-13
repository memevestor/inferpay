import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { config } from "dotenv";
import fs from "fs";
import path from "path";

config({ path: ".env.local" });

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});

let walletSetId = process.env.CIRCLE_WALLET_SET_ID ?? process.env.WALLET_SET_ID;
if (!walletSetId) {
  const setsRes = await client.listWalletSets({});
  walletSetId = setsRes.data?.walletSets?.[0]?.id;
  if (!walletSetId) {
    console.error("❌ Wallet Set not found. Run scripts/register-entity.mjs first.");
    process.exit(1);
  }
  console.log("🔍 Wallet Set ID (auto-discovered):", walletSetId);
}

const walletRes = await client.createWallets({
  blockchains: ["ARC-TESTNET"],
  count: 1,
  walletSetId,
  metadata: [{ name: "InferPay Demo Buyer" }],
});

const wallet = walletRes.data?.wallets?.[0];
if (!wallet) {
  console.error("❌ Failed to create wallet:", JSON.stringify(walletRes.data, null, 2));
  process.exit(1);
}

console.log("\n✅ Demo Buyer Wallet created!");
console.log("   Wallet ID :", wallet.id);
console.log("   Address   :", wallet.address);
console.log("\n👉 Fund it at: https://faucet.circle.com");
console.log("   Network: ARC-TESTNET, Address:", wallet.address);

// Append to .env.local
const envPath = path.resolve(".env.local");
const lines = [
  `\n# Demo Buyer Wallet (created ${new Date().toISOString()})`,
  `DEMO_BUYER_WALLET_ID=${wallet.id}`,
  `DEMO_BUYER_WALLET_ADDRESS=${wallet.address}`,
];
fs.appendFileSync(envPath, lines.join("\n") + "\n");
console.log("\n✅ .env.local updated with DEMO_BUYER_WALLET_ID and DEMO_BUYER_WALLET_ADDRESS");
