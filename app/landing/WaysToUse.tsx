// Three ways to use InferPay — routes users to the right starting point

function IconTarget() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
    </svg>
  );
}

function IconCpu() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="8" y="8" width="8" height="8" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="15" x2="23" y2="15" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="15" x2="4" y2="15" />
    </svg>
  );
}

function IconZap() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

type MetaLabel = { text: string };

function MetaTag({ text }: MetaLabel) {
  return (
    <span className="font-mono text-xs text-gray-600 border border-gray-800 rounded px-1.5 py-0.5">
      {text}
    </span>
  );
}

export function WaysToUse() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-16">
      <h2 className="text-2xl font-semibold text-white mb-3">
        Three ways to use InferPay
      </h2>
      <p className="text-gray-500 text-sm mb-10">
        Pick your starting point — from zero setup to full control.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* ── Card 1: Try Now (highlighted) ── */}
        <div className="flex flex-col gap-5 rounded-lg border border-green-800 bg-green-950/10 p-6">
          <div className="flex items-start justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-green-950/60 text-green-400">
              <IconTarget />
            </div>
            <span className="text-xs font-medium bg-green-950 text-green-400 border border-green-800 rounded-full px-2.5 py-0.5">
              Recommended
            </span>
          </div>

          <div>
            <p className="font-semibold text-white mb-2">Try Now</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              Use the live demo below. No wallet, no setup — we pay from our
              testnet account so you see the full x402 flow.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-auto">
            <MetaTag text="Zero setup" />
            <MetaTag text="5 req/min" />
            <MetaTag text="Arc Testnet" />
          </div>

          <a
            href="#demo"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-green-400 hover:text-green-300"
          >
            Try Demo ↓
          </a>
        </div>

        {/* ── Card 2: Agent SDK ── */}
        <div className="flex flex-col gap-5 rounded-lg border border-gray-800 bg-gray-900 p-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gray-800 text-gray-400">
            <IconCpu />
          </div>

          <div>
            <p className="font-semibold text-white mb-2">Agent SDK</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              Run our reference buyer agent. Requires a Circle API key and
              testnet USDC.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-auto">
            <MetaTag text="5 min setup" />
            <MetaTag text="Unlimited" />
            <MetaTag text="Arc Testnet" />
          </div>

          <a
            href="https://github.com/memevestor/inferpay"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-white"
          >
            View on GitHub →
          </a>
        </div>

        {/* ── Card 3: Raw API ── */}
        <div className="flex flex-col gap-5 rounded-lg border border-gray-800 bg-gray-900 p-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gray-800 text-gray-400">
            <IconZap />
          </div>

          <div>
            <p className="font-semibold text-white mb-2">Raw API</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              Build your own x402 client. Full control over wallet and payment
              signing.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-auto">
            <MetaTag text="Custom setup" />
            <MetaTag text="Unlimited" />
            <MetaTag text="Testnet & Mainnet" />
          </div>

          <a
            href="#integration"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-white"
          >
            Read Docs →
          </a>
        </div>
      </div>
    </section>
  );
}
