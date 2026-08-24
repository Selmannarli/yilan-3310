export interface AccountEnv {
  DB: D1Database;
  GOOGLE_CLIENT_IDS?: string;
}

type Language = "tr" | "en";
type Preferences = {
  nickname: string;
  avatar: string;
  language: Language;
  soundOn: boolean;
  vibrationOn: boolean;
  reduceMotion: boolean;
};

type GoogleClaims = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  aud: string | string[];
  iss: string;
  exp: number;
};

type GoogleJwk = JsonWebKey & { kid?: string };

const authCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Cache-Control": "no-store",
};

const encoder = new TextEncoder();
let googleKeys: { keys: GoogleJwk[]; expiresAt: number } | null = null;

export function isAccountRoute(pathname: string) {
  return pathname.startsWith("/auth/") || pathname === "/preferences" || pathname === "/feedback";
}

export async function handleAccountRequest(request: Request, env: AccountEnv): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { headers: authCors });
  const url = new URL(request.url);

  if (url.pathname === "/auth/config" && request.method === "GET") {
    return json({ clientId: clientIds(env)[0] ?? "" });
  }

  if (url.pathname === "/auth/google" && request.method === "POST") {
    const body = await readJson(request);
    const credential = typeof body.credential === "string" ? body.credential : "";
    if (!credential) return json({ error: "missing_credential" }, 400);
    const allowed = clientIds(env);
    if (!allowed.length) return json({ error: "google_auth_not_configured" }, 503);

    let claims: GoogleClaims;
    try {
      claims = await verifyGoogleIdToken(credential, allowed);
    } catch {
      return json({ error: "invalid_google_credential" }, 401);
    }

    const preferences = sanitizePreferences(body.preferences);
    const now = Date.now();
    const email = cleanText(claims.email, 254);
    const displayName = cleanText(claims.name, 100) || email.split("@")[0] || "SHOT Player";
    const pictureUrl = cleanText(claims.picture, 500);
    await env.DB.prepare(`
      INSERT INTO shot_users (
        google_sub, email, display_name, picture_url, nickname, avatar,
        language, sound_on, vibration_on, reduce_motion, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(google_sub) DO UPDATE SET
        email = excluded.email,
        display_name = excluded.display_name,
        picture_url = excluded.picture_url,
        updated_at = excluded.updated_at
    `).bind(
      claims.sub, email, displayName, pictureUrl, preferences.nickname, preferences.avatar,
      preferences.language, Number(preferences.soundOn), Number(preferences.vibrationOn),
      Number(preferences.reduceMotion), now, now,
    ).run();

    const token = randomToken();
    const tokenHash = await sha256(token);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM shot_sessions WHERE expires_at <= ?").bind(now),
      env.DB.prepare("INSERT INTO shot_sessions (token_hash, user_sub, expires_at, created_at) VALUES (?, ?, ?, ?)")
        .bind(tokenHash, claims.sub, now + 1000 * 60 * 60 * 24 * 30, now),
    ]);
    const profile = await getProfile(env, claims.sub);
    return json({ token, ...profile });
  }

  if (url.pathname === "/auth/session" && request.method === "GET") {
    const userSub = await authenticatedUserSub(request, env);
    if (!userSub) return json({ error: "unauthorized" }, 401);
    return json(await getProfile(env, userSub));
  }

  if (url.pathname === "/auth/logout" && request.method === "POST") {
    const token = bearerToken(request);
    if (token) await env.DB.prepare("DELETE FROM shot_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
    return json({ ok: true });
  }

  if (url.pathname === "/preferences" && request.method === "PUT") {
    const userSub = await authenticatedUserSub(request, env);
    if (!userSub) return json({ error: "unauthorized" }, 401);
    const body = await readJson(request);
    const preferences = sanitizePreferences(body);
    await env.DB.prepare(`
      UPDATE shot_users SET nickname = ?, avatar = ?, language = ?, sound_on = ?,
        vibration_on = ?, reduce_motion = ?, updated_at = ? WHERE google_sub = ?
    `).bind(
      preferences.nickname, preferences.avatar, preferences.language, Number(preferences.soundOn),
      Number(preferences.vibrationOn), Number(preferences.reduceMotion), Date.now(), userSub,
    ).run();
    return json({ ok: true, preferences });
  }

  if (url.pathname === "/feedback" && request.method === "POST") {
    const body = await readJson(request);
    const message = cleanText(body.message, 2000);
    if (message.length < 8) return json({ error: "feedback_too_short" }, 400);
    const ratingValue = Number(body.rating);
    const rating = Number.isInteger(ratingValue) && ratingValue >= 1 && ratingValue <= 5 ? ratingValue : null;
    const userSub = await authenticatedUserSub(request, env);
    await env.DB.prepare(`
      INSERT INTO shot_feedback (id, user_sub, message, rating, language, app_version, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), userSub, message, rating,
      body.language === "en" ? "en" : "tr", cleanText(body.appVersion, 30) || "web", Date.now(),
    ).run();
    return json({ ok: true }, 201);
  }

  return json({ error: "not_found" }, 404);
}

function clientIds(env: AccountEnv) {
  return (env.GOOGLE_CLIENT_IDS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
}

async function getProfile(env: AccountEnv, userSub: string) {
  const row = await env.DB.prepare(`
    SELECT email, display_name, picture_url, nickname, avatar, language,
      sound_on, vibration_on, reduce_motion
    FROM shot_users WHERE google_sub = ?
  `).bind(userSub).first<Record<string, string | number>>();
  if (!row) throw new Error("profile_not_found");
  return {
    user: {
      email: String(row.email),
      displayName: String(row.display_name),
      pictureUrl: String(row.picture_url || ""),
    },
    preferences: {
      nickname: String(row.nickname),
      avatar: String(row.avatar),
      language: row.language === "en" ? "en" : "tr",
      soundOn: Boolean(row.sound_on),
      vibrationOn: Boolean(row.vibration_on),
      reduceMotion: Boolean(row.reduce_motion),
    } satisfies Preferences,
  };
}

async function authenticatedUserSub(request: Request, env: AccountEnv) {
  const token = bearerToken(request);
  if (!token) return null;
  const row = await env.DB.prepare(
    "SELECT user_sub FROM shot_sessions WHERE token_hash = ? AND expires_at > ?",
  ).bind(await sha256(token), Date.now()).first<{ user_sub: string }>();
  return row?.user_sub ?? null;
}

function bearerToken(request: Request) {
  const match = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function sanitizePreferences(value: unknown): Preferences {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const nickname = cleanText(data.nickname, 24) || "SHOT Player";
  const avatarNumber = Math.max(0, Math.min(11, Math.floor(Number(data.avatar) || 0)));
  return {
    nickname,
    avatar: String(avatarNumber),
    language: data.language === "en" ? "en" : "tr",
    soundOn: data.soundOn !== false,
    vibrationOn: data.vibrationOn !== false,
    reduceMotion: data.reduceMotion === true,
  };
}

async function verifyGoogleIdToken(token: string, allowedAudiences: string[]): Promise<GoogleClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed_token");
  const header = decodePart<{ alg?: string; kid?: string }>(parts[0]);
  const claims = decodePart<GoogleClaims>(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("unsupported_token");
  const keys = await getGoogleKeys();
  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error("unknown_key");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5", key, fromBase64Url(parts[2]), encoder.encode(`${parts[0]}.${parts[1]}`),
  );
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!valid || !audiences.some((audience) => allowedAudiences.includes(audience))) throw new Error("invalid_signature");
  if (!["accounts.google.com", "https://accounts.google.com"].includes(claims.iss)) throw new Error("invalid_issuer");
  if (!claims.sub || claims.exp * 1000 <= Date.now() || claims.email_verified !== true) throw new Error("expired_or_unverified");
  return claims;
}

async function getGoogleKeys() {
  if (googleKeys && googleKeys.expiresAt > Date.now()) return googleKeys.keys;
  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!response.ok) throw new Error("google_keys_unavailable");
  const body = await response.json() as { keys: GoogleJwk[] };
  const maxAge = Number(response.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1] ?? 1800);
  googleKeys = { keys: body.keys, expiresAt: Date.now() + maxAge * 1000 };
  return body.keys;
}

function decodePart<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(fromBase64Url(value))) as T;
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, maxLength) : "";
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json();
    return value && typeof value === "object" ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: authCors });
}
