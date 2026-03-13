// Landing page — serves as the public-facing homepage for InferPay
// All components are co-located here; no barrel exports per project conventions

import type { ReactNode } from "react";
import { WaysToUse } from "./WaysToUse";
import { DemoTry } from "./DemoTry";
import { Integration } from "./Integration";

// ─── Nav ─────────────────────────────────────────────────────────────────────

export function Nav() {
  return (
    <header className="border-b border-gray-800">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <span className="font-mono text-sm font-bold text-white tracking-tight">
          inferpay
        </span>
        <nav className="flex items-center gap-6">
          <a
            href="https://docs.x402.org/introduction"
            className="text-sm text-gray-400 hover:text-white"
          >
            x402 Docs
          </a>
          <a
            href="https://developers.circle.com/wallets/dev-controlled/create-your-first-wallet"
            className="text-sm text-gray-400 hover:text-white"
          >
            Circle SDK
          </a>
          <a
            href="/"
            className="text-sm font-semibold text-gray-900 bg-white px-3.5 py-1.5 rounded-md"
          >
            Open Playground →
          </a>
        </nav>
      </div>
    </header>
  );
}

// ─── HeroBadge ────────────────────────────────────────────────────────────────

export function HeroBadge() {
  return (
    <div className="inline-flex items-center gap-2 border border-gray-800 rounded-full px-3.5 py-1">
      {/* green dot signals live testnet status */}
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
      <span className="font-mono text-xs text-gray-400 tracking-widest uppercase">
        Arc Testnet · USDC · x402
      </span>
    </div>
  );
}

// ─── CodeBlock ───────────────────────────────────────────────────────────────
// Shows the full 3-step x402 flow so developers immediately understand the protocol

export function CodeBlock() {
  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      {/* Fake macOS title bar to ground this visually as a terminal */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-900 border-b border-gray-800">
        <span className="w-2.5 h-2.5 rounded-full bg-gray-700" />
        <span className="w-2.5 h-2.5 rounded-full bg-gray-700" />
        <span className="w-2.5 h-2.5 rounded-full bg-gray-700" />
        <span className="ml-3 font-mono text-xs text-gray-600 select-none">
          x402 payment flow
        </span>
      </div>

      <pre className="bg-gray-900/60 px-5 py-5 text-xs font-mono overflow-x-auto leading-6 select-all">
        {/* Step 1 */}
        <span className="text-gray-600"># 1. Send request — no payment header yet</span>
        {"\n"}
        <span className="text-gray-400">$ curl -X POST </span>
        <span className="text-white">https://api.inferpay.app/v1/chat/completions</span>
        {" \\\n"}
        <span className="text-gray-400">    -H </span>
        <span className="text-emerald-400">&quot;Content-Type: application/json&quot;</span>
        {" \\\n"}
        <span className="text-gray-400">    -d </span>
        <span className="text-emerald-400">
          &apos;&#123;&quot;model&quot;:&quot;meta-llama/llama-3.1-70b-instruct&quot;,&quot;messages&quot;:[...]&#125;&apos;
        </span>
        {"\n\n"}

        {/* 402 response */}
        <span className="text-amber-400">HTTP/1.1 402 Payment Required</span>
        {"\n"}
        <span className="text-gray-500">&#123;</span>
        {"\n"}
        <span className="text-gray-500">  </span>
        <span className="text-sky-400">&quot;x402Version&quot;</span>
        <span className="text-gray-500">: </span>
        <span className="text-amber-300">1</span>
        <span className="text-gray-500">,</span>
        {"\n"}
        <span className="text-gray-500">  </span>
        <span className="text-sky-400">&quot;maxAmountRequired&quot;</span>
        <span className="text-gray-500">: </span>
        <span className="text-emerald-400">&quot;0.001&quot;</span>
        <span className="text-gray-500">,</span>
        {"\n"}
        <span className="text-gray-500">  </span>
        <span className="text-sky-400">&quot;network&quot;</span>
        <span className="text-gray-500">: </span>
        <span className="text-emerald-400">&quot;arc-testnet&quot;</span>
        <span className="text-gray-500">,</span>
        {"\n"}
        <span className="text-gray-500">  </span>
        <span className="text-sky-400">&quot;scheme&quot;</span>
        <span className="text-gray-500">: </span>
        <span className="text-emerald-400">&quot;exact&quot;</span>
        <span className="text-gray-500">,</span>
        {"\n"}
        <span className="text-gray-500">  </span>
        <span className="text-sky-400">&quot;payTo&quot;</span>
        <span className="text-gray-500">: </span>
        <span className="text-emerald-400">&quot;0xMERCHANT_WALLET...&quot;</span>
        {"\n"}
        <span className="text-gray-500">&#125;</span>
        {"\n\n"}

        {/* Step 2 */}
        <span className="text-gray-600"># 2. Sign EIP-3009 authorization + retry</span>
        {"\n"}
        <span className="text-gray-400">$ curl -X POST ... \</span>
        {"\n"}
        <span className="text-gray-400">    -H </span>
        <span className="text-emerald-400">&quot;X-Payment: &lt;signed_eip3009_auth&gt;&quot;</span>
        {"\n\n"}

        {/* 200 response */}
        <span className="text-emerald-400">HTTP/1.1 200 OK</span>
        <span className="text-gray-600">  — full response (no streaming in v0.1)</span>
        {"\n"}
        <span className="text-gray-500">&#123;</span>
        <span className="text-sky-400">&quot;choices&quot;</span>
        <span className="text-gray-500">: [</span>
        <span className="text-gray-500">&#123;</span>
        <span className="text-sky-400">&quot;message&quot;</span>
        <span className="text-gray-500">: &#123;</span>
        <span className="text-sky-400">&quot;content&quot;</span>
        <span className="text-gray-500">: </span>
        <span className="text-white">&quot;...&quot;</span>
        <span className="text-gray-500">&#125;&#125;], </span>
        <span className="text-sky-400">&quot;model&quot;</span>
        <span className="text-gray-500">: </span>
        <span className="text-white">&quot;llama-3.1-70b&quot;</span>
        <span className="text-gray-500">&#125;</span>
      </pre>
    </div>
  );
}

// ─── Feature icons as inline SVG ─────────────────────────────────────────────

function IconBolt() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-emerald-400"
    >
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function IconCpu() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-sky-400"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
    </svg>
  );
}

function IconKey() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-amber-400"
    >
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="M21 2l-9.6 9.6M15.5 7.5l3 3" />
    </svg>
  );
}

// ─── FeatureCard ─────────────────────────────────────────────────────────────

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  body: string;
  tag: string;
}

export function FeatureCard({ icon, title, body, tag }: FeatureCardProps) {
  return (
    <div className="border border-gray-800 rounded-lg p-6 flex flex-col gap-4">
      <div className="w-9 h-9 border border-gray-800 rounded-lg flex items-center justify-center bg-gray-900">
        {icon}
      </div>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <span className="font-mono text-xs text-gray-600 border border-gray-800 px-1.5 py-0.5 rounded">
            {tag}
          </span>
        </div>
        <p className="text-sm text-gray-400 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

// ─── FeaturesRow ─────────────────────────────────────────────────────────────

export function FeaturesRow() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <FeatureCard
        icon={<IconBolt />}
        title="Instant Settlement"
        tag="Circle Nanopayments"
        body="Off-chain confirmation in milliseconds. No block waiting. Circle batches settlement — merchants get instant credit."
      />
      <FeatureCard
        icon={<IconCpu />}
        title="Any LLM Model"
        tag="OpenRouter"
        body="One endpoint. 200+ models: Llama 3.1, Claude, GPT-4o, Mistral, Gemini. Switch models per request."
      />
      <FeatureCard
        icon={<IconKey />}
        title="No API Keys"
        tag="x402"
        body="Payment is authentication. Sign a USDC transfer with EIP-3009, attach it to the request. No accounts, no tokens."
      />
    </div>
  );
}

// ─── AgentEconomy icons ──────────────────────────────────────────────────────

function IconBot() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-violet-400"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M12 11V7" />
      <circle cx="12" cy="5" r="2" />
      <path d="M8 15h.01M16 15h.01" />
    </svg>
  );
}

function IconPlug() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-sky-400"
    >
      <path d="M12 22v-5" />
      <path d="M9 7V2" />
      <path d="M15 7V2" />
      <path d="M6 13v-2a6 6 0 0 1 12 0v2a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function IconCycle() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-emerald-400"
    >
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function IconTerminal() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-amber-400"
    >
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

// ─── AgentEconomy ─────────────────────────────────────────────────────────────

interface AgentCardProps {
  icon: ReactNode;
  title: string;
  desc: string;
}

function AgentCard({ icon, title, desc }: AgentCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 flex flex-col gap-4">
      <div className="w-9 h-9 bg-gray-800 border border-gray-700 rounded-lg flex items-center justify-center">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white mb-1.5">{title}</h3>
        <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

export function AgentEconomy() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-16">
      <div className="mb-10">
        <h2 className="text-2xl font-semibold text-white tracking-tight mb-2">
          Built for the Agent Economy
        </h2>
        <p className="text-gray-500 text-base">
          Your users are scripts and autonomous agents, not people clicking
          buttons.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AgentCard
          icon={<IconBot />}
          title="Autonomous AI Agents"
          desc="LangChain, CrewAI, AutoGPT agents get LLM access without human-managed API keys."
        />
        <AgentCard
          icon={<IconPlug />}
          title="MCP Servers"
          desc="MCP servers that call other LLMs as tools — pay per call, no setup."
        />
        <AgentCard
          icon={<IconCycle />}
          title="Agent-to-Agent Workflows"
          desc="One agent buys inference from another. USDC is the coordination layer."
        />
        <AgentCard
          icon={<IconTerminal />}
          title="Any HTTP Client"
          desc="Any software that can sign a USDC transfer and send a POST request."
        />
      </div>
    </section>
  );
}

// ─── Roadmap ──────────────────────────────────────────────────────────────────

interface RoadmapItemProps {
  version: string;
  title: string;
  desc: string;
  badge: "live" | "next" | "planned" | "future";
  active?: boolean;
}

function RoadmapItem({ version, title, desc, badge, active }: RoadmapItemProps) {
  const badgeStyles: Record<RoadmapItemProps["badge"], string> = {
    live: "bg-green-900/60 text-green-400 border border-green-700",
    next: "bg-yellow-900/30 text-yellow-400 border border-yellow-700",
    planned: "bg-gray-800 text-gray-500 border border-gray-700",
    future: "border border-gray-500 text-gray-400 bg-transparent",
  };
  const badgeLabels: Record<RoadmapItemProps["badge"], string> = {
    live: "Live",
    next: "Next",
    planned: "Planned",
    future: "Future",
  };

  return (
    <div
      className={[
        "flex-1 rounded-lg p-5 flex flex-col gap-3 border",
        active
          ? "bg-green-950/20 border-green-500"
          : "bg-gray-900 border-gray-800",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-gray-600">{version}</span>
        <span
          className={`font-mono text-xs px-2 py-0.5 rounded ${badgeStyles[badge]}`}
        >
          {badgeLabels[badge]}
        </span>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
        <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

export function Roadmap() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-16">
      <div className="mb-10">
        <h2 className="text-2xl font-semibold text-white tracking-tight mb-2">
          Roadmap
        </h2>
      </div>
      {/* Desktop: horizontal timeline with connector lines */}
      <div className="hidden md:flex items-stretch gap-0">
        <RoadmapItem
          version="v0.1"
          title="x402 Proxy"
          desc="x402 proxy + buyer agent + playground UI"
          badge="live"
          active
        />
        <div className="flex items-center px-1 shrink-0">
          <div className="w-6 h-px bg-gray-700" />
        </div>
        <RoadmapItem
          version="v0.2"
          title="Nanopayments"
          desc="Circle Nanopayments integration, gas-free batched settlement"
          badge="next"
        />
        <div className="flex items-center px-1 shrink-0">
          <div className="w-6 h-px bg-gray-700" />
        </div>
        <RoadmapItem
          version="v0.3"
          title="Token Pricing"
          desc="Token-based pricing, usage dashboard, multi-model routing"
          badge="planned"
        />
        <div className="flex items-center px-1 shrink-0">
          <div className="w-6 h-px bg-gray-700" />
        </div>
        <RoadmapItem
          version="v0.4"
          title="Agent Marketplace"
          desc="Agent-to-agent marketplace, agents sell skills for USDC"
          badge="planned"
        />
        <div className="flex items-center px-1 shrink-0">
          <div className="w-6 h-px bg-gray-700" />
        </div>
        <RoadmapItem
          version="v1.0"
          title="Mainnet"
          desc="Mainnet deployment, production security, real economics"
          badge="future"
        />
      </div>
      {/* Mobile: vertical stack */}
      <div className="flex md:hidden flex-col gap-3">
        <RoadmapItem
          version="v0.1"
          title="x402 Proxy"
          desc="x402 proxy + buyer agent + playground UI"
          badge="live"
          active
        />
        <RoadmapItem
          version="v0.2"
          title="Nanopayments"
          desc="Circle Nanopayments integration, gas-free batched settlement"
          badge="next"
        />
        <RoadmapItem
          version="v0.3"
          title="Token Pricing"
          desc="Token-based pricing, usage dashboard, multi-model routing"
          badge="planned"
        />
        <RoadmapItem
          version="v0.4"
          title="Agent Marketplace"
          desc="Agent-to-agent marketplace, agents sell skills for USDC"
          badge="planned"
        />
        <RoadmapItem
          version="v1.0"
          title="Mainnet"
          desc="Mainnet deployment, production security, real economics"
          badge="future"
        />
      </div>
    </section>
  );
}

// ─── Pricing ─────────────────────────────────────────────────────────────────

interface PricingCardProps {
  model: string;
  provider: string;
  price: string;
}

function PricingCard({ model, provider, price }: PricingCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 flex flex-col gap-4">
      <div>
        <p className="text-xs text-gray-500 mb-1">{provider}</p>
        <h3 className="font-mono text-sm font-semibold text-white leading-snug">
          {model}
        </h3>
      </div>
      <div>
        <p className="text-2xl font-semibold text-emerald-400 tracking-tight">
          {price}
        </p>
        <p className="text-xs text-gray-600 mt-0.5">per request</p>
      </div>
    </div>
  );
}

export function Pricing() {
  const models: PricingCardProps[] = [
    {
      model: "meta-llama/llama-3.1-70b-instruct",
      provider: "Meta",
      price: "0.001 USDC",
    },
    {
      model: "anthropic/claude-sonnet-4-5",
      provider: "Anthropic",
      price: "0.005 USDC",
    },
    { model: "openai/gpt-4o", provider: "OpenAI", price: "0.008 USDC" },
    {
      model: "anthropic/claude-opus-4-5",
      provider: "Anthropic",
      price: "0.010 USDC",
    },
  ];

  return (
    <section className="max-w-6xl mx-auto px-6 py-16">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-2xl font-semibold text-white tracking-tight">
            Simple Pricing
          </h2>
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-900/30 text-amber-400 border border-amber-700">
            Testnet only
          </span>
        </div>
        <p className="text-gray-500 text-base">
          Flat rate per request. No subscriptions. No minimums. Testnet USDC.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {models.map((m) => (
          <PricingCard key={m.model} {...m} />
        ))}
      </div>

      {/* MVP note */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex gap-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-gray-600 shrink-0 mt-0.5"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <p className="text-sm text-gray-500 leading-relaxed">
          <span className="text-gray-400 font-medium">MVP:</span> Fixed price
          per request, regardless of token count.{" "}
          <span className="text-gray-400 font-medium">Production:</span>{" "}
          Token-based pricing with prepaid balances or estimate-and-refund via
          Nanopayments.
        </p>
      </div>
    </section>
  );
}

// ─── HowItWorks ──────────────────────────────────────────────────────────────
// Condensed numbered steps so developers can scan the protocol at a glance

export function HowItWorks() {
  const steps = [
    {
      n: "01",
      label: "Request",
      detail: "POST to /v1/chat/completions with an OpenAI-compatible body.",
    },
    {
      n: "02",
      label: "402 Response",
      detail: "Server returns payment instructions: amount, payTo, network.",
    },
    {
      n: "03",
      label: "Sign",
      detail: "Client signs an EIP-3009 transferWithAuthorization off-chain.",
    },
    {
      n: "04",
      label: "Retry",
      detail: "Resend with X-Payment header. Circle validates in milliseconds.",
    },
    {
      n: "05",
      label: "Inference",
      detail: "Server proxies to OpenRouter, streams the LLM response back.",
    },
  ];

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/40">
        <h2 className="text-sm font-semibold text-white">How it works</h2>
      </div>
      <div className="divide-y divide-gray-800">
        {steps.map((s) => (
          <div key={s.n} className="flex items-start gap-5 px-6 py-4">
            <span className="font-mono text-xs text-gray-700 w-6 shrink-0 pt-0.5">
              {s.n}
            </span>
            <div>
              <span className="text-sm font-medium text-white">{s.label}</span>
              <span className="text-sm text-gray-500 ml-3">{s.detail}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

export function Footer() {
  return (
    <footer className="border-t border-gray-800 mt-24">
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Top row: links */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8">
          <span className="font-mono text-sm font-bold text-white tracking-tight">
            inferpay
          </span>
          <div className="flex flex-wrap items-center gap-6">
            <a
              href="https://github.com/memevestor/inferpay"
              className="text-xs text-gray-600 hover:text-gray-400 flex items-center gap-1.5"
            >
              {/* GitHub icon */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              GitHub
            </a>
            <a
              href="https://docs.x402.org/introduction"
              className="text-xs text-gray-600 hover:text-gray-400"
            >
              View Docs
            </a>
            <a
              href="https://www.circle.com/nanopayments"
              className="text-xs text-gray-600 hover:text-gray-400"
            >
              Circle Nanopayments
            </a>
            <a
              href="https://testnet.arcscan.app"
              className="text-xs text-gray-600 hover:text-gray-400"
            >
              Arc Explorer
            </a>
          </div>
        </div>

        {/* Bottom row: tagline + license */}
        <div className="border-t border-gray-800/60 pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <span className="font-mono text-xs text-gray-700">
            ARC Testnet · Built with Circle + OpenRouter
          </span>
          <span className="font-mono text-xs text-gray-700">
            MIT License · 2026
          </span>
        </div>

        {/* MVP notice */}
        <p className="text-gray-500 text-xs text-center mt-4">
          Testnet MVP · Demo uses pre-funded wallets · Production: agents pay
          with their own USDC
        </p>
      </div>
    </footer>
  );
}

// ─── Page (default export required by Next.js routing) ───────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Nav />

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="max-w-3xl">
          <div className="mb-8">
            <HeroBadge />
          </div>

          <h1 className="text-5xl sm:text-6xl font-semibold text-white tracking-tight leading-[1.08] mb-6">
            AI agents pay USDC
            <br />
            per LLM request.
          </h1>

          <p className="text-lg text-gray-400 leading-relaxed mb-4 max-w-2xl">
            Send a request. Get a{" "}
            <code className="font-mono text-amber-400 text-sm bg-amber-400/10 px-1.5 py-0.5 rounded">
              402
            </code>
            . Sign a USDC transfer. Get inference.
          </p>
          <p className="text-base text-gray-500 leading-relaxed mb-10 max-w-xl">
            Built on{" "}
            <span className="text-gray-300">Circle Nanopayments</span> and the{" "}
            <span className="text-gray-300">x402 standard</span>. No accounts,
            no API keys — the signed payment{" "}
            <em className="text-gray-300 not-italic font-medium">is</em> the
            authentication.
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href="#integration"
              className="inline-flex items-center gap-2 bg-white text-gray-900 text-sm font-semibold px-5 py-2.5 rounded-md"
            >
              Read the docs →
            </a>
            <a
              href="#demo"
              className="inline-flex items-center gap-2 border border-gray-700 hover:border-gray-500 text-gray-300 text-sm font-medium px-5 py-2.5 rounded-md"
            >
              Try live demo →
            </a>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="border-t border-gray-800" />
      </div>
      <section className="max-w-6xl mx-auto px-6 py-16">
        <HowItWorks />
      </section>

      {/* ── Ways to Use ── */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="border-t border-gray-800" />
      </div>
      <WaysToUse />

      {/* ── For Whom (Agent Economy) ── */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="border-t border-gray-800" />
      </div>
      <AgentEconomy />

      {/* ── Models (Pricing) ── */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="border-t border-gray-800" />
      </div>
      <Pricing />

      {/* ── Integration ── */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="border-t border-gray-800" />
      </div>
      <Integration />

      {/* ── Demo ── */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="border-t border-gray-800" />
      </div>
      <DemoTry />

      {/* ── Built With (Features) ── */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="border-t border-gray-800" />
      </div>
      <section className="max-w-6xl mx-auto px-6 py-16">
        <FeaturesRow />
      </section>

      {/* ── Roadmap ── */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="border-t border-gray-800" />
      </div>
      <Roadmap />

      <Footer />
    </div>
  );
}
