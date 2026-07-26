import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions, subscriptions, users } from "@/db/schema";
import { runtimeEnv } from "@/lib/runtime-env";

const encoder = new TextEncoder();
const SESSION_COOKIE = "planirov_session";

type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

function bytesToHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

async function hmac(key: BufferSource, data: string) {
  const importedKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", importedKey, encoder.encode(data));
}

export async function verifyTelegramInitData(initData: string) {
  const botToken = runtimeEnv().TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error("Telegram authentication is not configured");
  if (!initData || initData.length > 12_000) return null;

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash")?.toLowerCase();
  const authDate = Number(params.get("auth_date"));
  const rawUser = params.get("user");
  if (!receivedHash || !authDate || !rawUser) return null;

  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (ageSeconds < -60 || ageSeconds > 86_400) return null;

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = await hmac(encoder.encode("WebAppData"), botToken);
  const calculatedHash = bytesToHex(await hmac(secretKey, dataCheckString));
  if (!constantTimeEqual(receivedHash, calculatedHash)) return null;

  try {
    const user = JSON.parse(rawUser) as TelegramUser;
    if (
      !Number.isSafeInteger(user.id) ||
      !user.first_name ||
      user.first_name.length > 128
    ) {
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

function parseCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export function sessionCookie(
  sessionId: string,
  requestUrl: string,
  maxAgeSeconds = 60 * 60 * 24 * 30,
) {
  const secure = new URL(requestUrl).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie(requestUrl: string) {
  return sessionCookie("", requestUrl, 0);
}

export async function getRequestSession(request: Request) {
  const sessionId = parseCookie(request, SESSION_COOKIE);
  if (!sessionId) return null;
  const now = new Date().toISOString();
  const db = getDb();
  const rows = await db
    .select({
      sessionId: sessions.id,
      userId: users.id,
      telegramId: users.telegramId,
      displayName: users.displayName,
      username: users.username,
      role: users.role,
      plan: subscriptions.plan,
      planStatus: subscriptions.status,
      planExpiresAt: subscriptions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const activePlan =
    row.planStatus === "active" &&
    (!row.planExpiresAt || row.planExpiresAt > now)
      ? (row.plan ?? "free")
      : "free";

  return { ...row, plan: activePlan };
}

export async function telegramApi(method: string, body: unknown) {
  const token = runtimeEnv().TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Telegram bot is not configured");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Telegram API ${method} failed`);
  return response.json();
}
