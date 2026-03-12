import { Database } from "node-sqlite3-wasm";
import path from "path";
import fs from "fs";

const dbPath = process.env.DATABASE_PATH ?? "./data/inferpay.db";
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(dbPath);

db.run(`
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

export type TxRecord = {
  payer: string;
  model: string;
  amount_usdc: string;
  tx_hash?: string;
  status?: string;
};

export function insertTransaction(rec: TxRecord): void {
  db.run(
    `INSERT INTO transactions (payer, model, amount_usdc, tx_hash, status)
     VALUES (?, ?, ?, ?, ?)`,
    [rec.payer, rec.model, rec.amount_usdc, rec.tx_hash ?? null, rec.status ?? "confirmed"]
  );
}

export function listTransactions(limit = 50): unknown[] {
  return db.all("SELECT * FROM transactions ORDER BY id DESC LIMIT ?", [limit]);
}
