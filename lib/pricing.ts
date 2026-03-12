export const MODEL_PRICES: Record<string, string> = {
  "meta-llama/llama-3.1-70b-instruct": "0.001",
  "anthropic/claude-sonnet-4-6": "0.005",
  "openai/gpt-4o": "0.008",
  "anthropic/claude-opus-4-6": "0.01",
};

export const DEFAULT_PRICE = "0.001";

export function getPriceForModel(model: string): string {
  return MODEL_PRICES[model] ?? DEFAULT_PRICE;
}
