import pkg from '@circle-fin/developer-controlled-wallets';
import { config } from 'dotenv';
config({ path: '.env.local' });

const { initiateDeveloperControlledWalletsClient } = pkg;

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});

// Fetch WALLET_SET_ID from env or discover from existing wallet sets
let walletSetId = process.env.WALLET_SET_ID;
if (!walletSetId) {
  const setsRes = await client.listWalletSets({});
  walletSetId = setsRes.data?.walletSets?.[0]?.id;
  if (!walletSetId) {
    console.error('❌ Wallet Set не найден. Создай его через scripts/setup.sh или Circle Console.');
    process.exit(1);
  }
  console.log('🔍 Wallet Set ID (auto-discovered):', walletSetId);
}

const walletRes = await client.createWallets({
  blockchains: ['ARC-TESTNET'],
  count: 1,
  walletSetId,
  metadata: [{ name: 'InferPay Buyer Agent' }],
});

const wallet = walletRes.data?.wallets?.[0];
if (!wallet) {
  console.error('❌ Не удалось создать кошелёк:', JSON.stringify(walletRes.data, null, 2));
  process.exit(1);
}

console.log('✅ Buyer Wallet создан!');
console.log('Address:', wallet.address);
console.log('\nДобавь в .env.local:');
console.log(`BUYER_WALLET_ID=${wallet.id}`);
console.log(`BUYER_WALLET_ADDRESS=${wallet.address}`);
console.log(`WALLET_SET_ID=${walletSetId}`);
