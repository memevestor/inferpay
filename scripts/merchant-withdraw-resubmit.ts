// Recovery: resubmit a previously-issued Gateway attestation on-chain.
//
// When the original `merchant-withdraw.ts` flow obtains an attestation from
// Circle Gateway API but fails at `eth_sendRawTransaction` (e.g. txpool full),
// the merchant's Gateway balance is already debited but no Transfer was
// minted. The attestation+signature pair is single-use but not yet consumed.
//
// This script accepts the attestation bytes (saved from the failed run) and
// retries gatewayMint() on Arc Testnet. Idempotent: re-running after success
// will just revert with "already consumed" and waste gas.

import { config as loadEnv } from "dotenv";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";

loadEnv({ path: ".env.local" });

const GATEWAY_MINTER: Address = "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B";
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

const ATTESTATION: Hex =
  "0xff6fb334000000000000000000000000000000000000000000000000000000000252269600000154ca85def7000000010000001a0000001a0000000000000000000000000077777d7eba4688bdef3e311b846f25870a19b90000000000000000000000000022222abe238cc2c7bb1f21003f0a260052475b00000000000000000000000036000000000000000000000000000000000000000000000000000000000000003600000000000000000000000000000000000000000000000000000000000000681d42c9490a8f1a8a0d2435aed2f6a6d4576140000000000000000000000000681d42c9490a8f1a8a0d2435aed2f6a6d4576140000000000000000000000000681d42c9490a8f1a8a0d2435aed2f6a6d45761400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006604d24f0f7c3fa147d933f23ff2a0316b2347c8d20e8a7abefc93519a8f0681fdea500000000";

const ATT_SIGNATURE: Hex =
  "0x99a292e5ea59dcbedbfe54d9966c0800d9841799b16b4d44c5b5c8399dedf5aa093bfc1e94dbf2500217eb5d23e44b76413db5bc60443665a7273d7ec2a895661c";

const minterPrivateKey = (process.env.BUYER_PRIVATE_KEY ?? "") as Hex;
if (!minterPrivateKey) {
  console.error("❌ Missing BUYER_PRIVATE_KEY in .env.local");
  process.exit(1);
}

async function main() {
  const account = privateKeyToAccount(minterPrivateKey);
  const transport = http(ARC_RPC);
  const wallet = createWalletClient({ account, chain: arcTestnet, transport });
  const publicClient = createPublicClient({ chain: arcTestnet, transport });

  console.log(`Sender: ${account.address}`);
  console.log(`Resubmitting gatewayMint to ${GATEWAY_MINTER}...`);

  const txHash = await wallet.writeContract({
    address: GATEWAY_MINTER,
    abi: GATEWAY_MINTER_ABI,
    functionName: "gatewayMint",
    args: [ATTESTATION, ATT_SIGNATURE],
  });

  console.log(`Tx submitted: ${txHash}`);
  console.log(`Waiting for receipt...`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new Error(`gatewayMint reverted: ${txHash}`);
  }

  console.log(`\n✅ Mint successful`);
  console.log(`   Tx hash: ${txHash}`);
  console.log(`   ArcScan: ${ARCSCAN_TX}/${txHash}`);
}

main().catch((err) => {
  console.error("❌ Resubmit failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
