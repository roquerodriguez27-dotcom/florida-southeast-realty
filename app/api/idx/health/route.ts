import { NextResponse } from "next/server";
import { checkIdxConnection } from "@/lib/idx";

export const dynamic = "force-dynamic";

export async function GET() {
  const connection = await checkIdxConnection();
  return NextResponse.json(
    {
      ...connection,
      checkedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
