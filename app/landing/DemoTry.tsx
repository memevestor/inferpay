"use client";

import { useState } from "react";
import type { ReactNode } from "react";

const DEMO_BUYER = "0x9b35...ee0d";
const MERCHANT = "0x681d...6140";

type Status = "idle" | "loading" | "done" | "error";

type Result = {
  txHash: string;
  content: string;
  responseMs: number;
};

type DemoApiResponse = {
  txHash?: string;
  content?: string;
  error?: string;
};

export function DemoTry() {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!prompt.trim() || status === "loading") return;

    const start = Date.now();
    setStatus("loading");
    setStep(1);
    setResult(null);
    setErrorMsg("");

    try {
      const res = await fetch("/api/v1/demo/try", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "meta-llama/llama-3.1-70b-instruct",
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = (await res.json()) as DemoApiResponse;

      if (!res.ok) {
        setErrorMsg(data.error ?? "Request failed");
        setStatus("error");
        return;
      }

      await pause(700);
      setStep(2);
      await pause(700);
      setStep(3);
      setStatus("done");
      setResult({
        txHash: data.txHash ?? "",
        content: data.content ?? "",
        responseMs: Date.now() - start,
      });
    } catch {
      setErrorMsg("Network error — is the dev server running?");
      setStatus("error");
    }
  }

  const showStepper = status !== "idle";

  return (
    <section id="demo" className="max-w-6xl mx-auto px-6 py-16">
      <h2 className="text-2xl font-semibold text-white mb-3">Live Demo</h2>
      <p className="text-gray-500 text-sm mb-8">
        See the x402 payment flow in action — no wallet required.
      </p>

      {/* ── Info block ── */}
      <div className="bg-blue-950/30 border border-blue-800/40 rounded-lg p-4 mb-6 text-sm">
        <p className="font-medium text-gray-300 mb-1">Live Demo — Testnet MVP</p>
        <p className="text-gray-400 mb-4 leading-relaxed">
          This demo uses a pre-funded buyer wallet to execute a real USDC
          payment on Arc Testnet. You don&apos;t need a wallet.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-8">
          <InfoRow label="Demo buyer" value={DEMO_BUYER} mono />
          <InfoRow label="Merchant" value={MERCHANT} mono />
          <InfoRow label="Network" value="Arc Testnet" />
          <InfoRow label="Rate limit" value="5 requests / minute" />
        </div>
      </div>

      {/* ── Form ── */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-8">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask anything..."
          rows={3}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none font-mono"
        />
        <div className="flex flex-wrap items-center gap-3">
          <select
            disabled
            className="bg-gray-900 border border-gray-700 text-gray-400 text-sm rounded-md px-3 py-2 cursor-not-allowed"
          >
            <option>meta-llama/llama-3.1-70b-instruct</option>
          </select>
          <button
            type="submit"
            disabled={!prompt.trim() || status === "loading"}
            className="bg-white text-gray-900 text-sm font-semibold px-5 py-2 rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {status === "loading" ? "Processing…" : "Send Request"}
          </button>
        </div>
      </form>

      {/* ── Stepper ── */}
      {showStepper && (
        <div className="flex flex-col gap-3 mb-6">
          <StepBlock
            visible={step >= 1}
            label="1 — Request"
            content={
              <>
                <span className="text-amber-400">POST</span>
                <span className="text-gray-400">
                  {" "}
                  /api/v1/chat/completions →{" "}
                </span>
                <span className="text-yellow-300">402 Payment Required</span>
                {"\n"}
                <span className="text-gray-500">Price: </span>
                <span className="text-emerald-400">0.001 USDC</span>
                {"\n"}
                <span className="text-gray-500">Pay to: </span>
                <span className="text-blue-300">{MERCHANT}</span>
              </>
            }
          />
          <StepBlock
            visible={step >= 2}
            label="2 — Payment"
            content={
              <>
                <span className="text-blue-300">{DEMO_BUYER}</span>
                {"\n"}
                <span className="text-gray-500">{"→ "}</span>
                <span className="text-emerald-400">0.001 USDC</span>
                {"\n"}
                <span className="text-gray-500">{"→ "}</span>
                <span className="text-blue-300">{MERCHANT}</span>
                {"\n"}
                <span className="text-gray-500">tx: </span>
                <span className="font-mono text-xs text-gray-400">
                  {result?.txHash ?? (status === "loading" ? "pending…" : "")}
                </span>
              </>
            }
          />
          <StepBlock
            visible={step >= 3}
            label="3 — Response"
            content={
              <>
                <span className="text-emerald-400">200 OK</span>
                <span className="text-gray-400"> — LLM response delivered</span>
                {"\n"}
                <span className="text-gray-500">Model: </span>
                <span className="text-gray-300">
                  meta-llama/llama-3.1-70b-instruct
                </span>
                {"\n"}
                <span className="text-gray-500">Time: </span>
                <span className="text-gray-300">
                  {result ? `${result.responseMs}ms` : "…"}
                </span>
              </>
            }
          />
        </div>
      )}

      {/* ── Error ── */}
      {status === "error" && (
        <div className="bg-red-950/40 border border-red-800/40 rounded-lg p-4 text-sm text-red-400 mb-4">
          {errorMsg}
        </div>
      )}

      {/* ── LLM Response ── */}
      {status === "done" && result?.content && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 font-mono text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
          {result.content}
        </div>
      )}
    </section>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type InfoRowProps = { label: string; value: string; mono?: boolean };

function InfoRow({ label, value, mono = false }: InfoRowProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-500 w-24 shrink-0">{label}:</span>
      <span
        className={
          mono ? "font-mono text-sm text-blue-300" : "text-gray-400"
        }
      >
        {value}
      </span>
    </div>
  );
}

type StepBlockProps = {
  visible: boolean;
  label: string;
  content: ReactNode;
};

function StepBlock({ visible, label, content }: StepBlockProps) {
  return (
    <div
      className={`bg-gray-900 border-l-2 border-green-700 rounded-r-lg px-4 py-3 transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <p className="font-mono text-xs text-gray-500 uppercase tracking-wider mb-2">
        Step {label}
      </p>
      <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap">
        {content}
      </pre>
    </div>
  );
}
