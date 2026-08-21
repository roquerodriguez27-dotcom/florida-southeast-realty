import { NextResponse } from "next/server";
import { runPreviewIdxFilterDiagnostics } from "@/lib/idx";

export const dynamic = "force-dynamic";

export async function GET() {
  const diagnostics = await runPreviewIdxFilterDiagnostics();
  if (!diagnostics) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(diagnostics);
}
