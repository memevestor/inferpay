// node:sqlite — built-in since Node 22.5+, no native compilation needed.
// API is identical to better-sqlite3 (.prepare().run() / .prepare().all()).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require("node:sqlite");
import path from "path";
import fs from "fs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function openDb(): any | null {
  if (process.env.NEXT_PHASE === "phase-production-build") return null;
  const dbPath = process.env.DATABASE_PATH ?? "./data/inferpay.db";
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const database = new DatabaseSync(dbPath);
  // WAL mode: multiple readers, one writer — required for Next.js multi-thread env
  database.exec("PRAGMA journal_mode = WAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      payer       TEXT    NOT NULL,
      model       TEXT    NOT NULL,
      amount_usdc TEXT    NOT NULL,
      tx_hash     TEXT,
      status      TEXT    NOT NULL DEFAULT 'confirmed'
    )
  `);
  return database;
}

const db = openDb();

export type TxRecord = {
  payer: string;
  model: string;
  amount_usdc: string;
  tx_hash?: string;
  status?: string;
};

export function insertTransaction(rec: TxRecord): void {
  if (!db) return;
  db.prepare(
    `INSERT INTO transactions (payer, model, amount_usdc, tx_hash, status)
     VALUES (?, ?, ?, ?, ?)`
  ).run(rec.payer, rec.model, rec.amount_usdc, rec.tx_hash ?? null, rec.status ?? "confirmed");
}

export function listTransactions(limit = 50): unknown[] {
  if (!db) return [];
  return db.prepare("SELECT * FROM transactions ORDER BY id DESC LIMIT ?").all(limit);
}
