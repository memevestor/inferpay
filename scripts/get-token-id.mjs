import pkg from '@circle-fin/developer-controlled-wallets';
import { config } from 'dotenv';
config({ path: '.env.local' });

const { initiateDeveloperControlledWalletsClient } = pkg;

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});

const res = await client.getWalletTokenBalance({ id: process.env.BUYER_WALLET_ID });
const balances = res.data?.tokenBalances ?? [];

console.log('Токены на Buyer Wallet:');
for (const b of balances) {
  console.log(`  ${b.token?.symbol} | ID: ${b.token?.id} | Balance: ${b.amount} | Decimals: ${b.token?.decimals}`);
}

const usdc = balances.find(b => b.token?.symbol?.toUpperCase() === 'USDC');
if (usdc) {
  console.log('\nДобавь в .env.local:');
  console.log(`USDC_TOKEN_ID=${usdc.token?.id}`);
}
