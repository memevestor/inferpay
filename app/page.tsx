"use client";

import { useState, useEffect, useCallback } from "react";
import { MODEL_PRICES } from "@/lib/pricing";

const MODELS = Object.keys(MODEL_PRICES);

type Message = { role: "user" | "assistant"; content: string };
type PayStep = "idle" | "sending" | "got402" | "retrying" | "done" | "error";

type TxRow = {
  id: number;
  created_at: string;
  payer: string;
  model: string;
  amount_usdc: string;
  tx_hash: string | null;
  status: string;
};

const STEP_LABELS: Record<PayStep, string> = {
  idle: "",
  sending: "1/3 POST →",
  got402: "2/3 402 ↩ Payment Required",
  retrying: "3/3 Retry with X-Payment →",
  done: "✓ 200 OK",
  error: "✗ Error",
};

export default function Home() {
  const [model, setModel] = useState(MODELS[0]);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [payStep, setPayStep] = useState<PayStep>("idle");
  const [txLogs, setTxLogs] = useState<TxRow[]>([]);
  const [balance, setBalance] = useState<string | null>(null);

  const price = MODEL_PRICES[model];

  const fetchBalance = useCallback(async () => {
    const res = await fetch("/api/balance");
    if (res.ok) {
      const data = await res.json();
      setBalance(data.balance);
    }
  }, []);

  const fetchTxLogs = useCallback(async () => {
    const res = await fetch("/api/transactions");
    if (res.ok) setTxLogs(await res.json());
  }, []);

  useEffect(() => {
    fetchBalance();
    fetchTxLogs();
    const interval = setInterval(fetchBalance, 15_000);
    return () => clearInterval(interval);
  }, [fetchBalance, fetchTxLogs]);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setPayStep("sending");

    try {
      // Animate through the x402 steps visually
      await new Promise((r) => setTimeout(r, 200));
      setPayStep("got402");
      await new Promise((r) => setTimeout(r, 200));
      setPayStep("retrying");

      const res = await fetch("/api/v1/demo/try", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: newMessages }),
      });

      if (res.status === 429) {
        setPayStep("error");
        const data = await res.json();
        const secs = Math.max(0, (data.resetAt ?? 0) - Math.floor(Date.now() / 1000));
        setMessages([...newMessages, { role: "assistant", content: `Rate limit exceeded. Try again in ${secs}s.` }]);
      } else if (res.ok) {
        setPayStep("done");
        const data = await res.json();
        setMessages([...newMessages, { role: "assistant", content: data.llm_response ?? "(no response)" }]);
        await Promise.all([fetchTxLogs(), fetchBalance()]);
      } else {
        setPayStep("error");
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setMessages([...newMessages, { role: "assistant", content: `Error: ${err.error}` }]);
      }
    } catch (e) {
      setPayStep("error");
      setMessages([...newMessages, { role: "assistant", content: `Error: ${String(e)}` }]);
    }

    setLoading(false);
  }

  const stepColor: Record<PayStep, string> = {
    idle: "",
    sending: "bg-blue-900 text-blue-300",
    got402: "bg-yellow-900 text-yellow-300",
    retrying: "bg-blue-900 text-blue-300",
    done: "bg-green-900 text-green-300",
    error: "bg-red-900 text-red-300",
  };

  return (
    <main className="max-w-2xl mx-auto p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">InferPay Playground</h1>
        <div className="flex items-center gap-3">
          {balance !== null && (
            <span className="text-xs font-mono text-emerald-400">
              {parseFloat(balance).toFixed(6)} USDC
            </span>
          )}
          <span className="text-xs text-gray-500">Arc Testnet · USDC</span>
        </div>
      </div>

      {/* Model selector + price badge + step indicator */}
      <div className="flex gap-2 items-center">
        <select
          value={model}
          onChange={(e) => { setModel(e.target.value); setPayStep("idle"); }}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm flex-1"
        >
          {MODELS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <span className="text-xs bg-emerald-900 text-emerald-300 px-2 py-1 rounded font-mono whitespace-nowrap">
          {price} USDC / req
        </span>
        {payStep !== "idle" && (
          <span className={`text-xs px-2 py-1 rounded font-mono whitespace-nowrap ${stepColor[payStep]}`}>
            {STEP_LABELS[payStep]}
          </span>
        )}
      </div>

      {/* Chat window */}
      <div className="bg-gray-900 rounded-lg p-4 min-h-64 flex flex-col gap-3 text-sm">
        {messages.length === 0 && (
          <p className="text-gray-600 text-center mt-8">
            Send a message to trigger the x402 payment flow
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <span
              className={`inline-block px-3 py-2 rounded-lg max-w-prose whitespace-pre-wrap ${
                m.role === "user" ? "bg-blue-800" : "bg-gray-800"
              }`}
            >
              {m.content}
            </span>
          </div>
        ))}
        {loading && (
          <p className="text-gray-500 text-center text-xs animate-pulse">
            {STEP_LABELS[payStep]} …
          </p>
        )}
      </div>

      {/* x402 payment flow legend */}
      <div className="flex gap-1 items-center text-xs text-gray-600 justify-center">
        <span className="bg-gray-800 px-2 py-0.5 rounded">POST</span>
        <span>→</span>
        <span className="bg-yellow-900/40 text-yellow-600 px-2 py-0.5 rounded">402</span>
        <span>→</span>
        <span className="bg-gray-800 px-2 py-0.5 rounded">X-Payment</span>
        <span>→</span>
        <span className="bg-green-900/40 text-green-600 px-2 py-0.5 rounded">200 + LLM</span>
      </div>

      {/* Input + Pay & Ask button */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm flex-1"
        />
        <button
          onClick={send}
          disabled={loading}
          className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 px-4 py-2 rounded text-sm font-medium whitespace-nowrap"
        >
          {loading ? "…" : `Pay & Ask · ${price} USDC`}
        </button>
      </div>

      {/* Transaction log */}
      <div className="border border-gray-800 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Transaction Log
          </span>
          <button
            onClick={fetchTxLogs}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            ↻ refresh
          </button>
        </div>
        {txLogs.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-6">No transactions yet</p>
        ) : (
          <div className="divide-y divide-gray-800 max-h-64 overflow-y-auto">
            {txLogs.map((tx) => (
              <div
                key={tx.id}
                className="px-4 py-2 text-xs flex items-center gap-3 hover:bg-gray-900/50"
              >
                <span className="text-gray-500 font-mono w-32 shrink-0">
                  {tx.created_at.slice(0, 16).replace("T", " ")}
                </span>
                <span className="text-emerald-400 font-mono shrink-0">
                  {tx.amount_usdc} USDC
                </span>
                <span className="text-gray-400 truncate flex-1">
                  {tx.model.split("/")[1] ?? tx.model}
                </span>
                <a
                  href={`https://testnet.arcscan.app/address/${tx.payer}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-400 font-mono shrink-0 transition-colors"
                  title={`Payer: ${tx.payer}`}
                >
                  {tx.payer.slice(0, 6)}…{tx.payer.slice(-4)} ↗
                </a>
                <span
                  className={`shrink-0 ${
                    tx.status === "confirmed" ? "text-green-500" : "text-yellow-500"
                  }`}
                >
                  ●
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
