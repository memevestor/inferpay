import { GatewayClient } from "@circle-fin/x402-batching/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const buyer = new GatewayClient({
  chain: "arcTestnet",
  privateKey: process.env.BUYER_PRIVATE_KEY as `0x${string}`,
});

console.log("Address:", buyer.address);
const b = await buyer.getBalances();
console.log("Wallet USDC:", b.wallet.formatted);
console.log("Gateway USDC:", b.gateway.formattedAvailable);
