import type { ChatMessage } from "@/lib/llm";

// OpenAI's approximation: 1 token ≈ 4 chars for English/mixed text.
// We add 4 tokens of overhead per message (role + formatting markers).
// Safety margin: +20% to avoid undercharging on dense prompts.
const CHARS_PER_TOKEN = 4;
const OVERHEAD_PER_MESSAGE = 4;
const SAFETY_MARGIN = 1.2;

export function estimateTokens(messages: ChatMessage[]): number {
  let chars = 0;
  for (const msg of messages) {
    chars += msg.content.length;
  }
  const raw = Math.ceil(chars / CHARS_PER_TOKEN) + messages.length * OVERHEAD_PER_MESSAGE;
  return Math.ceil(raw * SAFETY_MARGIN);
}
