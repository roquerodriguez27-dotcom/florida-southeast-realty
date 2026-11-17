import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { fetchLiveListingSnapshot } from "@/lib/idx";
import { sendSavedSearchEmail } from "@/lib/saved-search-worker";

export interface BrokerListingAlertTestResult {
  /** The provider accepted the test request; this does not confirm inbox receipt. */
  accepted: boolean;
  message: string;
  testId?: string;
  listingAddress?: string;
  alreadyRequested?: boolean;
}

/** Call only after requireCrmBroker; brokerEmail comes from that session, never FormData or model output. */
export async function sendBrokerListingAlertTest({ brokerEmail }: { brokerEmail: string }): Promise<BrokerListingAlertTestResult> {
  const recipient = z.string().trim().toLowerCase().pipe(z.email().max(254)).safeParse(brokerEmail);
  if (!recipient.success) return { accepted: false, message: "Your signed-in broker account needs a valid email address." };

  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const recipientHash = createHash("sha256").update(recipient.data).digest("hex").slice(0, 16);
  const testId = `FSR-ALERT-TEST-${day}-${recipientHash}`;

  try {
    const snapshot = await fetchLiveListingSnapshot({ locations: ["Boynton Beach"], listingStatus: "active", sort: "newest" });
    if (!snapshot?.live || snapshot.unavailable) {
      return { accepted: false, message: "Live MLS listings are unavailable. No test email was sent." };
    }
    const listing = snapshot.listings.find(item => item.status === "Active"
      && item.mlsId?.trim() && item.slug?.trim() && item.address?.trim()
      && Number.isFinite(item.price) && item.price > 0);
    if (!listing) {
      return { accepted: false, message: "No current matching home was available for the test. No test email was sent." };
    }

    const result = await sendSavedSearchEmail({
      email: recipient.data,
      frequency: "instant",
      changes: { newMatches: [listing], priceChanges: [], backOnMarket: [] },
      searchId: testId,
      testPreview: { id: testId },
    });
    if (!result.configured) return { accepted: false, message: "Email delivery is not configured. No test email was sent." };
    if (result.testAlreadyRequested) {
      return { accepted: false, alreadyRequested: true, testId, message: `A test for this UTC day was already requested. Check your inbox for ${testId}. Only one sample is allowed per UTC day; this status does not confirm inbox delivery.` };
    }
    if (!result.delivered) {
      return { accepted: false, testId, message: "The provider did not confirm acceptance of this test. Check your inbox before retrying; another click uses the same daily request ID." };
    }
    return {
      accepted: true,
      testId,
      listingAddress: listing.address,
      message: `The email provider accepted your test request. Check your inbox for ${testId}. Repeated clicks use the same request, with at most one sample per UTC day.`,
    };
  } catch {
    // Provider and MLS errors may include request details. Do not log them.
    return { accepted: false, testId, message: "The test could not be completed. Check your inbox before retrying; another click uses the same daily request ID." };
  }
}
