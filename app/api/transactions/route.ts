import { NextResponse } from "next/server";
import { listTransactions } from "@/lib/db";

export function GET() {
  return NextResponse.json(listTransactions(20));
}
