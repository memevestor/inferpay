import pkg from '@circle-fin/developer-controlled-wallets';
import { config } from 'dotenv';
import crypto from 'crypto';

config({ path: '.env.local' });

const { initiateDeveloperControlledWalletsClient } = pkg;

const apiKey = process.env.CIRCLE_API_KEY;
const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

if (!apiKey || !entitySecret) {
  console.error('❌ Missing CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET in .env.local');
  process.exit(1);
}

const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

const { data: keyData } = await client.getPublicKey({});
const publicKey = keyData?.publicKey;
if (!publicKey) {
  console.error('❌ Failed to fetch public key');
  process.exit(1);
}

const entitySecretBuf = Buffer.from(entitySecret, 'hex');
const ciphertext = crypto.publicEncrypt(
  { key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
  entitySecretBuf
).toString('base64');

console.log('\n✅ Entity Secret Ciphertext (base64):');
console.log('─'.repeat(60));
console.log(ciphertext);
console.log('─'.repeat(60));
console.log('\n📋 Next steps:');
console.log('1. Go to https://console.circle.com');
console.log('2. Navigate to: Settings → Entity Secret Ciphertext');
console.log('3. Paste the ciphertext above and save');
console.log('4. Re-run this project to create wallets\n');
