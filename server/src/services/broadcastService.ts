// broadcastService.ts — Sync pilot accounts with the share-portal (Circus Broadcast).
// All calls are fire-and-forget: failures are logged but never bubble up to callers.
import type { Pilot } from "../db/schema.js";

const API_URL  = process.env.SHARE_PORTAL_API_URL?.trimEnd().replace(/\/$/, "") ?? "";
const API_KEY  = process.env.SHARE_PORTAL_INTEGRATION_KEY ?? "";
const PROVIDER = "circus-racing";

function isConfigured(): boolean {
  return Boolean(API_URL && API_KEY);
}

async function post(path: string, body: unknown): Promise<void> {
  if (!isConfigured()) return;

  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-integration-key": API_KEY,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`share-portal ${path} → ${response.status}: ${text}`);
  }
}

/** Called after a pilot is created or updated in Circus Racing. */
export async function syncPilot(pilot: Pilot): Promise<void> {
  if (!isConfigured()) return;
  try {
    await post("/api/integrations/race-site/users/upsert", {
      externalProvider: PROVIDER,
      externalUserId:   pilot.id,
      username:         pilot.displayName,
      displayName:      pilot.displayName,
      streamPath:       `live_${pilot.id}`,
      status:           "active",
    });
  } catch (err) {
    console.warn("[broadcast] syncPilot failed:", (err as Error).message);
  }
}

/** Called after a pilot is deleted or permanently disabled. */
export async function deactivatePilot(pilotId: string): Promise<void> {
  if (!isConfigured()) return;
  try {
    await post("/api/integrations/race-site/users/deactivate", {
      externalProvider: PROVIDER,
      externalUserId:   pilotId,
    });
  } catch (err) {
    console.warn("[broadcast] deactivatePilot failed:", (err as Error).message);
  }
}

/** Called after a pilot changes their password. */
export async function notifyPasswordChanged(pilotId: string): Promise<void> {
  if (!isConfigured()) return;
  try {
    await post("/api/integrations/race-site/users/password-changed", {
      externalProvider: PROVIDER,
      externalUserId:   pilotId,
    });
  } catch (err) {
    console.warn("[broadcast] notifyPasswordChanged failed:", (err as Error).message);
  }
}

/**
 * Issues a short-lived SSO token from the share-portal for a given pilot.
 * Returns the token and its expiry, or null if the share-portal is unreachable.
 */
export async function issueSsoToken(
  pilotId: string,
  target = "/"
): Promise<{ token: string; expiresAt: number; redirectUrl: string } | null> {
  if (!isConfigured()) return null;
  try {
    const response = await fetch(`${API_URL}/api/integrations/race-site/sso-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-integration-key": API_KEY,
      },
      body: JSON.stringify({ externalProvider: PROVIDER, externalUserId: pilotId, target }),
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`share-portal sso-token → ${response.status}: ${text}`);
    }

    const data = await response.json() as { token: string; expiresAt: number; target: string };

    const targetPath = data.target || "/";
    const redirect = new URL(targetPath, `${API_URL}/`);
    redirect.searchParams.set("token", data.token);

    return {
      token: data.token,
      expiresAt: data.expiresAt,
      redirectUrl: redirect.toString(),
    };
  } catch (err) {
    console.warn("[broadcast] issueSsoToken failed:", (err as Error).message);
    return null;
  }
}
