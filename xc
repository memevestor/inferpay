# InferPay: Nanopayments SDK Integration

## Что происходит

Переключаем payment layer с кастомного Circle Developer-Controlled Wallets flow на официальный `@circle-fin/x402-batching` SDK. Это решает ВСЕ критические проблемы MVP:

- ❌ Closed loop (только наши кошельки) → ✅ Любой buyer с Gateway Wallet может платить
- ❌ Нет криптографической верификации → ✅ EIP-3009 verify через Gateway API
- ❌ Нет replay protection → ✅ Nonce check на стороне Gateway
- ❌ Gas на каждый transfer → ✅ Батчинг: zero gas per payment
- ❌ Kастомный base64 JSON в X-Payment → ✅ Стандартный x402 v2 protocol

## Production URL

- https://ipayx402.xyz/
- https://ipayx402.xyz/landing
- https://ipayx402.xyz/api/v1/chat/completions

## Текущий стек (НЕ меняется)

- Next.js 14 (App Router), TypeScript strict
- OpenRouter API (LLM proxy)
- SQLite via node:sqlite (transaction logs)
- Arc Testnet (USDC 6 decimals)
- Tailwind CSS, PM2

## Что меняется

### Старый payment flow (УДАЛЯЕМ):

```
1. Buyer → POST без X-Payment → 402 (наш кастомный JSON)
2. Buyer формирует base64 JSON { from, to, value, nonce }
3. Buyer → POST с X-Payment header
4. Server парсит base64 → validateNanopayment() → парсинг JSON, проверка value/to
5. Server → sendUsdcTransfer() → Circle Developer-Controlled Wallets SDK → onchain tx
6. Server → proxyToOpenRouter() → 200
```

### Новый payment flow (ВНЕДРЯЕМ):

```
1. Buyer → POST без payment header → 402 Payment Required (x402 v2 standard)
   Response включает: paymentRequirements с scheme, network, amount, payTo, extra
2. Buyer подписывает EIP-3009 TransferWithAuthorization (offchain, zero gas)
3. Buyer → POST с X-PAYMENT header (x402 v2 payment payload)
4. Server → BatchFacilitatorClient.verify(payload, requirements) → Gateway API проверяет подпись
5. Server → BatchFacilitatorClient.settle(payload, requirements) → Gateway принимает в батч
6. Server → proxyToOpenRouter() → 200 + billing info
```

## Новый npm пакет

```bash
npm install @circle-fin/x402-batching
```

Документация: https://developers.circle.com/gateway/nanopayments/references/sdk

## Архитектурное решение: Вариант C (прямые вызовы SDK)

НЕ используем Express middleware (`createGatewayMiddleware`). Вместо этого вызываем SDK классы напрямую внутри Next.js API route. Это сохраняет текущую архитектуру.

Используем на SELLER стороне:
- `BatchFacilitatorClient` — verify() и settle() платежей
- `GatewayEvmScheme` — формирование paymentRequirements для 402 response

Используем на BUYER стороне (в agent/buyer.ts):
- `GatewayClient` — deposit(), pay(), getBalances()

## Пошаговый план реализации

### Phase 1: Setup + Seller (Day 1)

**Шаг 1.1: Install SDK**

```bash
npm install @circle-fin/x402-batching viem
```

`viem` — зависимость SDK для EVM взаимодействий. Если уже установлен, пропусти.

**Шаг 1.2: Создать lib/nanopay-v2.ts (НОВЫЙ ФАЙЛ)**

Не трогай старый `lib/nanopay.ts` — он остаётся для fallback/demo.

```typescript
// lib/nanopay-v2.ts
import { BatchFacilitatorClient, GatewayEvmScheme } from "@circle-fin/x402-batching/server";

// Инициализация facilitator client (для verify + settle)
export const facilitator = new BatchFacilitatorClient();

// Инициализация scheme (для формирования 402 requirements)
export const gatewayScheme = new GatewayEvmScheme();

// Получить supported networks при старте
export async function initGateway() {
  const supported = await facilitator.getSupported();
  console.log("Gateway supported networks:", supported.kinds.map(k => k.network));
  return supported;
}

// Сформировать 402 response
export function build402ResponseV2(params: {
  price: string;        // "$0.005" или "0.005"
  sellerAddress: string;
  network: string;      // "eip155:5042002" для Arc Testnet
}) {
  // Используй gatewayScheme.enhancePaymentRequirements() 
  // для добавления extra.verifyingContract
  // Возвращай стандартный x402 v2 402 response
}

// Верифицировать платёж
export async function verifyPayment(
  paymentPayload: unknown,
  paymentRequirements: unknown
) {
  const result = await facilitator.verify(paymentPayload, paymentRequirements);
  if (!result.isValid) {
    return { ok: false, error: result.invalidReason };
  }
  return { ok: true, payer: result.payer };
}

// Settle платёж (отправить в батч)
export async function settlePayment(
  paymentPayload: unknown,
  paymentRequirements: unknown
) {
  const result = await facilitator.settle(paymentPayload, paymentRequirements);
  if (!result.success) {
    return { ok: false, error: result.errorReason };
  }
  return { ok: true, payer: result.payer, transaction: result.transaction };
}
```

**Шаг 1.3: Обновить app/api/v1/chat/completions/route.ts**

Новый flow:

```typescript
import { verifyPayment, settlePayment, build402ResponseV2 } from "@/lib/nanopay-v2";
import { proxyToOpenRouter } from "@/lib/llm";
import { insertTransaction } from "@/lib/db";
import { getPriceForModel } from "@/lib/pricing";

export async function POST(req: Request) {
  const body = await req.json();
  const model = body.model;
  const price = getPriceForModel(model);

  if (!price) {
    return Response.json({ error: "Unsupported model" }, { status: 400 });
  }

  // Читаем x402 payment header
  const paymentHeader = req.headers.get("x-payment");

  if (!paymentHeader) {
    // Шаг 1: Нет оплаты → 402
    const requirements = build402ResponseV2({
      price: price,
      sellerAddress: process.env.CIRCLE_WALLET_ADDRESS!,
      network: "eip155:5042002", // Arc Testnet
    });
    return Response.json(requirements, {
      status: 402,
      headers: { "X-PAYMENT-REQUIRED": JSON.stringify(requirements) }
    });
  }

  // Шаг 2: Есть payment → verify
  const paymentPayload = JSON.parse(
    Buffer.from(paymentHeader, "base64").toString()
  );
  const requirements = build402ResponseV2({
    price: price,
    sellerAddress: process.env.CIRCLE_WALLET_ADDRESS!,
    network: "eip155:5042002",
  });

  const verifyResult = await verifyPayment(paymentPayload, requirements);
  if (!verifyResult.ok) {
    return Response.json(
      { error: "Payment verification failed", reason: verifyResult.error },
      { status: 402 }
    );
  }

  // Шаг 3: Verify прошёл → settle (отправить в батч)
  const settleResult = await settlePayment(paymentPayload, requirements);
  if (!settleResult.ok) {
    return Response.json(
      { error: "Payment settlement failed", reason: settleResult.error },
      { status: 500 }
    );
  }

  // Шаг 4: Оплата принята → proxy к LLM
  const llmResponse = await proxyToOpenRouter(body);

  // Шаг 5: Логируем
  insertTransaction({
    model,
    amount_usdc: price,
    tx_hash: settleResult.transaction,
    payer: settleResult.payer || "unknown",
    status: "settled",
    payment_method: "nanopayments",
  });

  return Response.json({
    ...llmResponse,
    billing: {
      price_usdc: price,
      payer: settleResult.payer,
      settlement: settleResult.transaction,
      method: "nanopayments",
    },
  });
}
```

IMPORTANT: Точная реализация build402ResponseV2 зависит от формата, который ожидает `BatchFacilitatorClient.verify()`. Изучи SDK types — `PaymentRequirements` и `PaymentPayload`. Используй `gatewayScheme.enhancePaymentRequirements()` для правильного формата.

**Шаг 1.4: Тест seller стороны**

```bash
# Должен вернуть 402 с x402 v2 payment requirements
curl -s -X POST https://ipayx402.xyz/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"meta-llama/llama-3.1-70b-instruct","messages":[{"role":"user","content":"ping"}]}' | jq .
```

Проверь что 402 response содержит: scheme, network, amount, payTo, extra.verifyingContract.

### Phase 2: Buyer Agent (Day 1-2)

**Шаг 2.1: Создать agent/buyer-v2.ts (НОВЫЙ ФАЙЛ)**

```typescript
// agent/buyer-v2.ts
import { GatewayClient } from "@circle-fin/x402-batching/client";

const INFERPAY_URL = "https://ipayx402.xyz/api/v1/chat/completions";

async function main() {
  const buyer = new GatewayClient({
    chain: "arcTestnet",
    privateKey: process.env.BUYER_PRIVATE_KEY as `0x${string}`,
  });

  console.log("Buyer address:", buyer.address);

  // Проверяем балансы
  const balances = await buyer.getBalances();
  console.log("Wallet USDC:", balances.wallet.formatted);
  console.log("Gateway USDC:", balances.gateway.formattedAvailable);

  // Если Gateway баланс 0 — депозитим
  if (balances.gateway.available === 0n) {
    console.log("\nDepositing 5 USDC into Gateway...");
    const deposit = await buyer.deposit("5.0");
    console.log("Deposit tx:", deposit.depositTxHash);
    console.log("Deposited:", deposit.formattedAmount, "USDC");
  }

  // 5 запросов
  for (let i = 1; i <= 5; i++) {
    console.log(`\n--- Request ${i}/5 ---`);

    const result = await buyer.pay(INFERPAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "meta-llama/llama-3.1-70b-instruct",
        messages: [{ role: "user", content: `Test #${i}. What is ${i} + ${i}?` }],
      }),
    });

    console.log("Status:", result.status);
    console.log("Paid:", result.formattedAmount, "USDC");
    console.log("Response:", JSON.stringify(result.data).slice(0, 100) + "...");
  }

  const finalBalances = await buyer.getBalances();
  console.log("\n--- Final balances ---");
  console.log("Gateway USDC:", finalBalances.gateway.formattedAvailable);
}

main().catch(console.error);
```

**Шаг 2.2: Настройка buyer**

Buyer-у нужен приватный ключ EOA кошелька (НЕ Developer-Controlled Wallet).

```bash
# Генерация ключа:
node -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))"

# Добавь в .env.local:
BUYER_PRIVATE_KEY=0x...

# Зафанди USDC:
# 1. Узнай адрес: npx tsx -e "import {GatewayClient} from '@circle-fin/x402-batching/client'; const c = new GatewayClient({chain:'arcTestnet',privateKey:process.env.BUYER_PRIVATE_KEY as any}); console.log(c.address)"
# 2. Иди на https://faucet.circle.com → вставь адрес → Arc Testnet
```

**Шаг 2.3: Тест**

```bash
BUYER_PRIVATE_KEY=0x... npx tsx agent/buyer-v2.ts
# Ожидание: deposit → 5/5 successful → баланс уменьшился
```

### Phase 3: Demo Endpoint Update (Day 2)

**Шаг 3.1: Обновить /api/v1/demo/try**

Demo buyer теперь использует GatewayClient вместо Circle Dev-Controlled Wallets.

```bash
# Новая env переменная:
DEMO_BUYER_PRIVATE_KEY=0x...   # EOA private key для demo buyer
```

Внутри demo endpoint:
1. Инициализировать `GatewayClient` с `DEMO_BUYER_PRIVATE_KEY`
2. Для каждого demo-запроса: вызвать `demoBuyer.pay()` к собственному endpoint
   — ИЛИ: вызвать `build402ResponseV2` + `BatchEvmScheme.createPaymentPayload` + `settlePayment` напрямую (без HTTP к себе)
3. Собрать steps[] для UI stepper

IMPORTANT: Demo buyer EOA кошелёк нужно зафандить и сделать Gateway deposit заранее.

**Шаг 3.2: Обновить env vars**

```bash
# УДАЛИТЬ (больше не нужны для payment flow):
# DEMO_BUYER_WALLET_ID        — был для Circle Dev-Controlled Wallets

# ДОБАВИТЬ:
DEMO_BUYER_PRIVATE_KEY=0x...   # EOA private key для demo buyer
BUYER_PRIVATE_KEY=0x...         # Для тестирования buyer-v2.ts

# ОСТАВИТЬ:
CIRCLE_WALLET_ADDRESS=0x681d...6140   # Merchant address (seller)
CIRCLE_API_KEY=                        # Для legacy/balance checks
CIRCLE_ENTITY_SECRET=                  # Для legacy
```

### Phase 4: Cleanup + Test (Day 2)

**Шаг 4.1: Переименовать старые файлы (НЕ удалять)**

```
lib/nanopay.ts      → lib/nanopay-legacy.ts
agent/buyer.ts      → agent/buyer-legacy.ts
```

**Шаг 4.2: Обновить lib/db.ts**

Добавить поля в transactions:

```typescript
payment_method: "nanopayments" | "direct-transfer" | "demo"
payer: string          // 0x buyer address
settlement_tx: string  // from settle()
```

**Шаг 4.3: Full e2e тест**

```bash
# 1. 402 response формат:
curl -s https://ipayx402.xyz/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"meta-llama/llama-3.1-70b-instruct","messages":[{"role":"user","content":"ping"}]}' | jq .
# Проверь: scheme, network, payTo, extra.verifyingContract

# 2. Buyer agent 5/5:
BUYER_PRIVATE_KEY=0x... npx tsx agent/buyer-v2.ts

# 3. Demo endpoint:
curl -s https://ipayx402.xyz/api/v1/demo/try \
  -H "Content-Type: application/json" \
  -d '{"model":"meta-llama/llama-3.1-70b-instruct","messages":[{"role":"user","content":"test"}]}' | jq .

# 4. Transaction log:
curl -s https://ipayx402.xyz/api/transactions | jq .[0].payment_method
# Expected: "nanopayments"
```

## Файлы для создания (НОВЫЕ)

```
lib/nanopay-v2.ts                   # SDK wrapper (seller side)
agent/buyer-v2.ts                    # New buyer using GatewayClient
```

## Файлы для изменения

```
app/api/v1/chat/completions/route.ts # Переключить на nanopay-v2
app/api/v1/demo/try/route.ts         # Переключить demo на GatewayClient
lib/db.ts                            # Добавить payment_method, payer
lib/pricing.ts                       # Цены в формате "$0.005"
package.json                         # + @circle-fin/x402-batching, viem
.env.local                           # + DEMO_BUYER_PRIVATE_KEY, BUYER_PRIVATE_KEY
```

## Файлы НЕ трогать

```
app/page.tsx                          # Playground UI
app/landing/                          # Landing page
app/components/landing/               # Landing components
lib/llm.ts                            # OpenRouter proxy
lib/rate-limit.ts                     # Rate limiter
```

## Файлы переименовать (НЕ удалять)

```
lib/nanopay.ts      → lib/nanopay-legacy.ts
agent/buyer.ts      → agent/buyer-legacy.ts
```

## Критические моменты

1. **Arc Testnet chain ID** — проверь что `"arcTestnet"` есть в `CHAIN_CONFIGS` SDK. Если нет, может потребоваться custom chain config или другое имя. Chain ID для Arc Testnet: 5042002.

2. **Формат 402 response** — SDK ожидает конкретный `PaymentRequirements` type. Не изобретай формат — используй SDK types и `gatewayScheme.enhancePaymentRequirements()`.

3. **Private keys** — НИКОГДА не коммить. Добавь `DEMO_BUYER_PRIVATE_KEY` и `BUYER_PRIVATE_KEY` в `.gitignore` / `.env.local`.

4. **Gateway deposit** — buyer должен deposit USDC в Gateway Wallet (одна onchain tx с gas). Это одноразово. Потом все платежи offchain, zero gas. Demo buyer: deposit 10 USDC при первом запуске.

5. **Backwards compatibility** — demo endpoint должен продолжать работать. Если SDK ломается, используй legacy flow.

6. **viem версия** — проверь peer dependencies после `npm install`.

7. **x402 header name** — SDK использует `X-PAYMENT` header (uppercase). Проверь что Next.js не lowercase-ит его.

## Порядок (СТРОГИЙ)

```
1. npm install @circle-fin/x402-batching viem
2. lib/nanopay-v2.ts → тест facilitator.getSupported()
3. route.ts → тест 402 response
4. agent/buyer-v2.ts → тест deposit + pay
5. demo endpoint update
6. db.ts update
7. Full e2e
8. Переименовать legacy файлы
```

Каждый шаг = тест. Не перепрыгивай.

## Ссылки

- SDK Reference: https://developers.circle.com/gateway/nanopayments/references/sdk
- Nanopayments Overview: https://developers.circle.com/gateway/nanopayments
- Buyer Quickstart: https://developers.circle.com/gateway/nanopayments/quickstarts/buyer
- Seller Quickstart: https://developers.circle.com/gateway/nanopayments/quickstarts/seller
- x402 Concept: https://developers.circle.com/gateway/nanopayments/concepts/x402
- Batched Settlement: https://developers.circle.com/gateway/nanopayments/concepts/batched-settlement
- Supported Networks: https://developers.circle.com/gateway/nanopayments/supported-networks
- npm: @circle-fin/x402-batching
- x402 Seller Quickstart (Coinbase): https://docs.x402.org/getting-started/quickstart-for-sellers
- Arc Testnet Faucet: https://faucet.circle.com
- Arc Testnet Explorer: https://testnet.arcscan.app
