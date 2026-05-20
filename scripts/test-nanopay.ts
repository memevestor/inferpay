import { BatchFacilitatorClient } from "@circle-fin/x402-batching/server";

const facilitator = new BatchFacilitatorClient();

const supported = await facilitator.getSupported();

console.log("=== Full getSupported() response ===");
console.log(JSON.stringify(supported, null, 2));

console.log("\n=== Networks in supported.kinds ===");
const networks = supported.kinds.map((k: { network: string }) => k.network);
console.log(networks);

const arcTestnet = "eip155:5042002";
const hasArc = networks.includes(arcTestnet);
console.log(`\n=== Arc Testnet (${arcTestnet}) supported: ${hasArc} ===`);
