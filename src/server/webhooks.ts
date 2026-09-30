import { after } from "next/server";
import { env } from "@/lib/env";
import type { Session } from "@/lib/session";

export type WebhookEvent = "asset.ai_tags_saved" | "asset.restored" | "brand.updated";

export type WebhookPayload = {
  event: WebhookEvent;
  assetId: string | null;
  brandId: string | null;
  userEmail: string;
  timestamp: string;
};

/** POST one event to n8n. Never throws: a webhook failure must not break the app. */
export async function sendWebhook(payload: WebhookPayload) {
  const url = env.N8N_WEBHOOK_URL;
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(env.N8N_WEBHOOK_SECRET ? { "x-brandvault-secret": env.N8N_WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error(`Webhook ${payload.event} failed: HTTP ${res.status}`);
  } catch (err) {
    console.error(`Webhook ${payload.event} failed:`, (err as Error).message);
  }
}

/**
 * Queue an event to be sent after the response is returned, so the user never
 * waits on n8n. Falls back to sending immediately outside a request (tests, scripts).
 */
export function emitEvent(
  event: WebhookEvent,
  session: Session,
  ids: { assetId?: string; brandId?: string },
) {
  const payload: WebhookPayload = {
    event,
    assetId: ids.assetId ?? null,
    brandId: ids.brandId ?? null,
    userEmail: session.email,
    timestamp: new Date().toISOString(),
  };
  try {
    after(() => sendWebhook(payload));
  } catch {
    void sendWebhook(payload);
  }
}
