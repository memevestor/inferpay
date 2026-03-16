export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { listTransactions } from "@/lib/db";

export function GET(req: NextRequest) {
  const token = req.headers.get("x-admin-token");
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(listTransactions(20));
}
