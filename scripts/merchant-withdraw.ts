// Withdraw merchant Gateway balance back to merchant DCW address.
//
// Why this script exists: Circle Nanopayments accumulate buyer funds on the
// merchant's Gateway internal balance. There's no ERC-20 Transfer event for
// these — they appear only in submitBatch() internal accounting. To produce
// a real Transfer event visible in Circle Console, we must trigger Gateway's
// burn-and-mint flow: sign a BurnIntent → get attestation → call gatewayMint
// on the destination chain. Same-chain withdraw still mints a fresh USDC
// transfer to the recipient.
//
// Why we don't use GatewayClient.withdraw(): merchant is a Circle DCW (MPC),
// no local private key. We replicate the flow:
//   1. Build BurnIntent EIP-712 typed data (sourceDepositor=merchant DCW)
//   2. Sign via DCW.signTypedData (only step that requires merchant key)
//   3. POST to Gateway API → receive attestation
//   4. Call gatewayMint(attestation, signature) from any funded EOA
//      (buyer EOA already has USDC for gas on Arc Testnet)

import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { config as loadEnv } from "dotenv";
import {
  createPublicClient,
  createWalletClient,
  http,
  pad,
  parseUnits,
  formatUnits,
  maxUint256,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";
import { randomBytes } from "node:crypto";

loadEnv({ path: ".env.local" });

const ARC_DOMAIN = 26;
const ARC_USDC: Address = "0x3600000000000000000000000000000000000000";
const GATEWAY_WALLET: Address = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";
const GATEWAY_MINTER: Address = "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B";
const GATEWAY_API = "https://gateway-api-testnet.circle.com/v1";
const ARC_RPC = "https://rpc.testnet.arc.network";
const ARCSCAN_TX = "https://testnet.arcscan.app/tx";

const GATEWAY_MINTER_ABI = [
  {
    name: "gatewayMint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "attestationPayload", type: "bytes" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

const merchantAddress = (process.env.CIRCLE_WALLET_ADDRESS ?? "").toLowerCase() as Address;
const apiKey = process.env.CIRCLE_API_KEY ?? "";
const entitySecret = process.env.CIRCLE_ENTITY_SECRET ?? "";
const minterPrivateKey = (process.env.BUYER_PRIVATE_KEY ?? "") as Hex;

if (!merchantAddress || !apiKey || !entitySecret || !minterPrivateKey) {
  console.error("❌ Missing env: CIRCLE_WALLET_ADDRESS, CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, BUYER_PRIVATE_KEY");
  process.exit(1);
}

// Optional CLI arg: amount in USDC (decimal string). If omitted, withdraws (balance - 0.05) reserved for fees.
const cliAmount = process.argv[2];

type GatewayBalance = { available: string };

async function fetchMerchantGatewayBalance(): Promise<GatewayBalance> {
  const res = await fetch(`${GATEWAY_API}/balances`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: "USDC",
      sources: [{ depositor: merchantAddress, domain: ARC_DOMAIN }],
    }),
  });
  const data = (await res.json()) as { balances?: Array<{ balance: string }>; message?: string };
  if (!res.ok || !data.balances?.length) {
    throw new Error(`Gateway API balance error: ${data.message ?? res.statusText}`);
  }
  return { available: data.balances[0].balance };
}

async function resolveMerchantWalletId(): Promise<string> {
  const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
  const res = await client.listWallets({ address: merchantAddress });
  const wallets = res.data?.wallets ?? [];
  const match = wallets.find((w) => w.address?.toLowerCase() === merchantAddress);
  if (!match?.id) throw new Error(`No DCW found for address ${merchantAddress}`);
  return match.id;
}

function buildBurnIntent(valueAtomic: bigint, maxFeeAtomic: bigint, recipient: Address) {
  const toBytes32 = (addr: Address): Hex => pad(addr.toLowerCase() as Hex, { size: 32 });
  return {
    maxBlockHeight: maxUint256,
    maxFee: maxFeeAtomic,
    spec: {
      version: 1,
      sourceDomain: ARC_DOMAIN,
      destinationDomain: ARC_DOMAIN,
      sourceContract: toBytes32(GATEWAY_WALLET),
      destinationContract: toBytes32(GATEWAY_MINTER),
      sourceToken: toBytes32(ARC_USDC),
      destinationToken: toBytes32(ARC_USDC),
      sourceDepositor: toBytes32(merchantAddress),
      destinationRecipient: toBytes32(recipient),
      sourceSigner: toBytes32(merchantAddress),
      destinationCaller: toBytes32(zeroAddress),
      value: valueAtomic,
      salt: `0x${randomBytes(32).toString("hex")}` as Hex,
      hookData: "0x" as Hex,
    },
  };
}

function buildTypedData(burnIntent: ReturnType<typeof buildBurnIntent>) {
  // EIP-712 schema mirrors @circle-fin/x402-batching/dist/client/index.js:1052
  return {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
      ],
      TransferSpec: [
        { name: "version", type: "uint32" },
        { name: "sourceDomain", type: "uint32" },
        { name: "destinationDomain", type: "uint32" },
        { name: "sourceContract", type: "bytes32" },
        { name: "destinationContract", type: "bytes32" },
        { name: "sourceToken", type: "bytes32" },
        { name: "destinationToken", type: "bytes32" },
        { name: "sourceDepositor", type: "bytes32" },
        { name: "destinationRecipient", type: "bytes32" },
        { name: "sourceSigner", type: "bytes32" },
        { name: "destinationCaller", type: "bytes32" },
        { name: "value", type: "uint256" },
        { name: "salt", type: "bytes32" },
        { name: "hookData", type: "bytes" },
      ],
      BurnIntent: [
        { name: "maxBlockHeight", type: "uint256" },
        { name: "maxFee", type: "uint256" },
        { name: "spec", type: "TransferSpec" },
      ],
    },
    primaryType: "BurnIntent",
    domain: { name: "GatewayWallet", version: "1" },
    message: burnIntent,
  };
}

const bigintReplacer = (_: string, v: unknown) => (typeof v === "bigint" ? v.toString() : v);

async function signWithDcw(walletId: string, typedData: ReturnType<typeof buildTypedData>): Promise<Hex> {
  const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
  const json = JSON.stringify(typedData, bigintReplacer);
  const res = await client.signTypedData({ walletId, data: json });
  const sig = res.data?.signature;
  if (!sig) throw new Error("DCW signTypedData returned no signature");
  return sig as Hex;
}

async function requestAttestation(burnIntent: ReturnType<typeof buildBurnIntent>, signature: Hex) {
  const body = JSON.stringify([{ burnIntent, signature }], bigintReplacer);
  const res = await fetch(`${GATEWAY_API}/transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const data = (await res.json()) as {
    attestation?: Hex;
    signature?: Hex;
    success?: boolean;
    error?: string;
    message?: string;
  };
  if (!res.ok || !data.attestation || !data.signature) {
    throw new Error(`Gateway API /transfer error: ${data.message ?? data.error ?? JSON.stringify(data)}`);
  }
  return { attestation: data.attestation, signature: data.signature };
}

async function submitGatewayMint(attestation: Hex, attSig: Hex): Promise<Hex> {
  const account = privateKeyToAccount(minterPrivateKey);
  const transport = http(ARC_RPC);
  const wallet = createWalletClient({ account, chain: arcTestnet, transport });
  const publicClient = createPublicClient({ chain: arcTestnet, transport });

  const txHash = await wallet.writeContract({
    address: GATEWAY_MINTER,
    abi: GATEWAY_MINTER_ABI,
    functionName: "gatewayMint",
    args: [attestation, attSig],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new Error(`gatewayMint tx reverted: ${txHash}`);
  }
  return txHash;
}

async function main() {
  console.log(`Merchant DCW: ${merchantAddress}`);

  const before = await fetchMerchantGatewayBalance();
  console.log(`Gateway balance: ${before.available} USDC`);

  const balanceAtomic = parseUnits(before.available, 6);
  const reserveAtomic = parseUnits("0.05", 6);

  let valueAtomic: bigint;
  if (cliAmount) {
    valueAtomic = parseUnits(cliAmount, 6);
    if (valueAtomic > balanceAtomic) {
      throw new Error(`Requested ${cliAmount} > available ${before.available}`);
    }
  } else {
    if (balanceAtomic <= reserveAtomic) {
      throw new Error(`Balance ${before.available} too low (need >0.05 USDC for safety reserve)`);
    }
    valueAtomic = balanceAtomic - reserveAtomic;
  }

  // Cap maxFee at the value itself — Circle's facilitator deducts actual fee
  // from this bound. For testnet the real fee is typically zero.
  const maxFeeAtomic = valueAtomic;
  console.log(`Withdrawing: ${formatUnits(valueAtomic, 6)} USDC → ${merchantAddress}`);

  const walletId = await resolveMerchantWalletId();
  console.log(`Resolved walletId: ${walletId}`);

  const burnIntent = buildBurnIntent(valueAtomic, maxFeeAtomic, merchantAddress);
  const typedData = buildTypedData(burnIntent);

  console.log("Signing BurnIntent via DCW...");
  const userSig = await signWithDcw(walletId, typedData);

  console.log("Requesting attestation from Gateway API...");
  const { attestation, signature: attSig } = await requestAttestation(burnIntent, userSig);

  console.log("Submitting gatewayMint on Arc Testnet...");
  const txHash = await submitGatewayMint(attestation, attSig);

  console.log(`\n✅ Withdraw complete`);
  console.log(`   Tx hash: ${txHash}`);
  console.log(`   ArcScan: ${ARCSCAN_TX}/${txHash}`);
  console.log(`   Transfer event: ${formatUnits(valueAtomic, 6)} USDC → ${merchantAddress}`);

  const after = await fetchMerchantGatewayBalance();
  console.log(`\nGateway balance after: ${after.available} USDC`);
}

main().catch((err) => {
  console.error("❌ Withdraw failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
