"use client";

import { useState, useEffect } from "react";

const MODELS = [
  { id: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B", price: "0.001" },
  { id: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6", price: "0.005" },
  { id: "openai/gpt-4o", label: "GPT-4o", price: "0.008" },
  { id: "anthropic/claude-opus-4-6", label: "Claude Opus 4.6", price: "0.010" },
];

type Step = {
  step: string;
  description: string;
  status: number | string;
  timestamp: string;
  data: Record<string, unknown>;
};

type DemoResult = {
  steps: Step[];
  llm_response: string;
  total_time_ms: number;
  price_usdc: string;
  tx_hash: string | null;
  note: string;
};

type StepState = "pending" | "active" | "done";

function StepRow({
  index,
  label,
  state,
  detail,
}: {
  index: number;
  label: string;
  state: StepState;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
          state === "done"
            ? "bg-emerald-500 text-black"
            : state === "active"
            ? "bg-blue-500 text-white animate-pulse"
            : "bg-gray-700 text-gray-500"
        }`}
      >
        {state === "done" ? "✓" : index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium ${
            state === "done"
              ? "text-emerald-400"
              : state === "active"
              ? "text-blue-300"
              : "text-gray-600"
          }`}
        >
          {label}
        </p>
        {detail && state === "done" && (
          <p className="text-xs font-mono text-gray-500 truncate mt-0.5">{detail}</p>
        )}
      </div>
    </div>
  );
}

export default function DemoTry() {
  const [model, setModel] = useState(MODELS[0].id);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [resetAt, setResetAt] = useState<number | null>(null);

  const selectedModel = MODELS.find((m) => m.id === model) ?? MODELS[0];

  useEffect(() => {
    fetch("/api/v1/demo/config")
      .then((r) => r.json())
      .then((d) => {
        setRemaining(d.remaining ?? null);
        if (d.resetAt) setResetAt(d.resetAt);
      })
      .catch(() => {});
  }, []);

  async function handleTry() {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setActiveStep(0);

    // Simulate step progression while waiting
    const stepTimer = setTimeout(() => setActiveStep(1), 800);
    const stepTimer2 = setTimeout(() => setActiveStep(2), 1800);

    try {
      const res = await fetch("/api/v1/demo/try", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] }),
      });

      clearTimeout(stepTimer);
      clearTimeout(stepTimer2);

      if (res.status === 429) {
        const data = await res.json();
        setResetAt(data.resetAt ?? null);
        setRemaining(0);
        setError("rate_limit");
        setActiveStep(-1);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Unknown error");
        setActiveStep(-1);
        return;
      }

      const data: DemoResult = await res.json();
      setActiveStep(3); // all done
      setResult(data);

      // Refresh rate limit info
      const configRes = await fetch("/api/v1/demo/config");
      const config = await configRes.json();
      setRemaining(config.remaining ?? 0);
      if (config.resetAt) setResetAt(config.resetAt);
    } catch (e) {
      clearTimeout(stepTimer);
      clearTimeout(stepTimer2);
      setError(String(e));
      setActiveStep(-1);
    } finally {
      setLoading(false);
    }
  }

  const STEP_LABELS = [
    { label: "Sending request...", detail: (r: DemoResult) => `402 · ${r.steps[0]?.data?.price_usdc} USDC required` },
    { label: "Processing payment...", detail: (r: DemoResult) => `${r.steps[1]?.data?.amount_usdc} USDC from ${String(r.steps[1]?.data?.from ?? "").slice(0, 10)}…` },
    { label: "Getting LLM response...", detail: (r: DemoResult) => `${r.steps[2]?.data?.tokens_used} tokens · ${r.total_time_ms}ms` },
  ];

  const secondsUntilReset = resetAt ? Math.max(0, resetAt - Math.floor(Date.now() / 1000)) : null;

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 flex flex-col gap-5 max-w-xl w-full mx-auto font-mono">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white text-base font-semibold tracking-tight">
            Live x402 Demo
          </h3>
          <p className="text-gray-500 text-xs mt-0.5">
            Full payment flow · Arc Testnet · USDC
          </p>
        </div>
        {remaining !== null && (
          <span
            className={`text-xs px-2 py-1 rounded font-mono ${
              remaining === 0 ? "bg-red-900/40 text-red-400" : "bg-gray-800 text-gray-400"
            }`}
          >
            {remaining} req left
          </span>
        )}
      </div>

      {/* Model selector */}
      <div className="flex gap-2 items-center">
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={loading}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 flex-1 focus:outline-none focus:border-gray-500 disabled:opacity-50"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <span className="text-xs bg-emerald-900/40 text-emerald-400 border border-emerald-800/50 px-2 py-1.5 rounded-lg whitespace-nowrap">
          {selectedModel.price} USDC
        </span>
      </div>

      {/* Prompt input */}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Ask anything..."
        disabled={loading}
        rows={3}
        className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 resize-none focus:outline-none focus:border-gray-500 placeholder-gray-600 disabled:opacity-50"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleTry();
        }}
      />

      {/* CTA button */}
      {error === "rate_limit" ? (
        <div className="bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-3 text-center">
          <p className="text-red-400 text-sm">Rate limit reached.</p>
          {secondsUntilReset !== null && (
            <p className="text-gray-500 text-xs mt-1">
              Try again in {secondsUntilReset}s
            </p>
          )}
        </div>
      ) : (
        <button
          onClick={handleTry}
          disabled={loading || !prompt.trim() || remaining === 0}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
        >
          {loading ? "Running..." : `Try x402 Flow → ${selectedModel.price} USDC`}
        </button>
      )}

      {/* Error (non rate-limit) */}
      {error && error !== "rate_limit" && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-3">
          <p className="text-red-400 text-xs">{error}</p>
        </div>
      )}

      {/* Step tracker */}
      {(loading || result) && (
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 flex flex-col gap-3">
          {STEP_LABELS.map((s, i) => {
            const state: StepState =
              activeStep > i ? "done" : activeStep === i ? "active" : "pending";
            return (
              <StepRow
                key={i}
                index={i}
                label={s.label}
                state={state}
                detail={result ? s.detail(result) : undefined}
              />
            );
          })}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="flex flex-col gap-3">
          {/* LLM response */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">
              LLM Response
            </p>
            <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
              {result.llm_response}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-900/60 border border-gray-800 rounded-lg py-2 px-3">
              <p className="text-emerald-400 text-sm font-semibold">{result.price_usdc}</p>
              <p className="text-gray-600 text-xs">USDC paid</p>
            </div>
            <div className="bg-gray-900/60 border border-gray-800 rounded-lg py-2 px-3">
              <p className="text-blue-400 text-sm font-semibold">{result.total_time_ms}ms</p>
              <p className="text-gray-600 text-xs">total time</p>
            </div>
            <div className="bg-gray-900/60 border border-gray-800 rounded-lg py-2 px-3">
              <p className="text-gray-300 text-xs font-mono truncate">
                {result.tx_hash ? result.tx_hash.slice(0, 8) + "…" : "—"}
              </p>
              <p className="text-gray-600 text-xs">tx hash</p>
            </div>
          </div>

          <p className="text-center text-xs text-gray-600">{result.note}</p>
        </div>
      )}
    </div>
  );
}
