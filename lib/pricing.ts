// Per-token pricing. All arithmetic in bigint (USDC 6 decimals) — no float.
// Testnet values are decorative but reflect real proportions between models.

type ModelPricing = {
  inputPer1K: string;      // USDC per 1 000 input tokens
  outputPer1K: string;     // USDC per 1 000 output tokens
  maxOutputDefault: number; // token budget if max_tokens not specified in request
};

export const MODEL_PRICING: Record<string, ModelPricing> = {
  "meta-llama/llama-3.1-70b-instruct": {
    inputPer1K: "0.00009",
    outputPer1K: "0.00009",
    maxOutputDefault: 1024,
  },
  "anthropic/claude-sonnet-4-6": {
    inputPer1K: "0.003",
    outputPer1K: "0.015",
    maxOutputDefault: 1024,
  },
  "openai/gpt-4o": {
    inputPer1K: "0.0025",
    outputPer1K: "0.010",
    maxOutputDefault: 1024,
  },
  "anthropic/claude-opus-4-6": {
    inputPer1K: "0.015",
    outputPer1K: "0.075",
    maxOutputDefault: 1024,
  },
};

// Minimum charge to ensure Circle Nanopayments accepts the amount.
const MIN_PRICE = "0.0001";

// "0.00009" → 90n (USDC 6 decimals, bigint — no float rounding)
function parseUsdc6(price: string): bigint {
  const [whole = "0", frac = ""] = price.split(".");
  const padded = frac.padEnd(6, "0").slice(0, 6);
  return BigInt(whole) * 1_000_000n + BigInt(padded);
}

// price = inputTokens * inputPer1K / 1000 + maxOutputTokens * outputPer1K / 1000
// Returns USDC string like "0.003210", minimum MIN_PRICE.
export function calculatePrice(
  model: string,
  inputTokens: number,
  maxOutputTokens: number
): string {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return MIN_PRICE;

  const inputRate = parseUsdc6(pricing.inputPer1K);
  const outputRate = parseUsdc6(pricing.outputPer1K);

  const inputCost = (inputRate * BigInt(inputTokens)) / 1000n;
  const outputCost = (outputRate * BigInt(maxOutputTokens)) / 1000n;
  const total = inputCost + outputCost;

  const minAtomic = parseUsdc6(MIN_PRICE);
  const final = total < minAtomic ? minAtomic : total;

  // Convert atomic USDC back to decimal string
  const whole = final / 1_000_000n;
  const frac = (final % 1_000_000n).toString().padStart(6, "0");
  return `${whole}.${frac}`;
}

// Convenience: estimate price for a model with default output budget.
// Used by UI to show a price badge before knowing actual prompt length.
export function getDefaultPrice(model: string): string {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return MIN_PRICE;
  // Approximate 200 input tokens as a typical short prompt for the badge
  return calculatePrice(model, 200, pricing.maxOutputDefault);
}

export const SUPPORTED_MODELS = Object.keys(MODEL_PRICING);
