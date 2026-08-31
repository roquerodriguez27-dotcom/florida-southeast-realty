import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const resendApiKeyConfigured = Boolean(process.env.RESEND_API_KEY?.trim());
  const resendEmailDomainConfigured = Boolean(process.env.RESEND_EMAIL_DOMAIN?.trim());
  const resendFromEmailConfigured = Boolean(process.env.RESEND_FROM_EMAIL?.trim());

  return NextResponse.json(
    {
      provider: "resend",
      configured: resendApiKeyConfigured,
      apiKeyConfigured: resendApiKeyConfigured,
      emailDomainConfigured: resendEmailDomainConfigured,
      fromEmailConfigured: resendFromEmailConfigured,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
