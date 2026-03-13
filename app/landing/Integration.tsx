"use client";

import { useState } from "react";

type Tab = "demo" | "agent" | "raw";

const TABS: { id: Tab; label: string }[] = [
  { id: "demo", label: "Demo (zero setup)" },
  { id: "agent", label: "Buyer Agent (5 min setup)" },
  { id: "raw", label: "Raw API (custom client)" },
];

const CODE: Record<Tab, string> = {
  demo: `curl -X POST https://ipayx402.xyz/api/v1/demo/try \\
  -H "Content-Type: application/json" \\
  -d '{"model":"meta-llama/llama-3.1-70b-instruct",
       "messages":[{"role":"user","content":"What is x402?"}]}'`,

  agent: `git clone https://github.com/memevestor/inferpay
cd inferpay
# Add CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET to .env.local
npm install && npm run setup
npx tsx agent/buyer.ts`,

  raw: `# Step 1: Get price
curl -s https://ipayx402.xyz/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{"model":"meta-llama/llama-3.1-70b-instruct","messages":[{"role":"user","content":"hi"}]}'
# → 402 { amount: "1000", payTo: "0x681d...6140" }

# Step 2: Pay and retry
curl -s https://ipayx402.xyz/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "X-Payment: <base64-signed-usdc-auth>" \\
  -d '{"model":"meta-llama/llama-3.1-70b-instruct","messages":[{"role":"user","content":"hi"}]}'
# → 200 + LLM response`,
};

export function Integration() {
  const [activeTab, setActiveTab] = useState<Tab>("demo");

  return (
    <section id="integration" className="max-w-6xl mx-auto px-6 py-16">
      <h2 className="text-2xl font-semibold text-white mb-3">Integration</h2>
      <p className="text-gray-500 text-sm mb-6">
        Three ways to call InferPay from your code.
      </p>

      <div className="max-w-3xl">
        {/* Tab bar */}
        <div className="flex bg-gray-800 rounded-t-lg overflow-hidden">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-gray-700 border-b-2 border-green-500 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Code block */}
        <div className="bg-gray-900 border border-gray-800 border-t-0 rounded-b-lg p-6 overflow-x-auto">
          <pre className="font-mono text-sm text-gray-300 leading-relaxed">
            {CODE[activeTab]}
          </pre>
        </div>
      </div>
    </section>
  );
}
