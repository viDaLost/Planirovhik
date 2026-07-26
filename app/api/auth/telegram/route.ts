import { eq, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions, subscriptions, users } from "@/db/schema";
import { runtimeEnv } from "@/lib/runtime-env";
import {
  getRequestSession,
  sessionCookie,
  verifyTelegramInitData,
} from "@/lib/server-auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { initData?: unknown };
    if (typeof body.initData !== "string") {
      return Response.json({ error: "initData is required" }, { status: 400 });
    }

    const telegramUser = await verifyTelegramInitData(body.initData);
    if (!telegramUser) {
      return Response.json(
        { error: "Telegram signature is invalid or expired" },
        { status: 401 },
      );
    }

    const userId = `tg:${telegramUser.id}`;
    const displayName =
      [telegramUser.first_name, telegramUser.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || "Пользователь";
    const adminIds = new Set(
      (runtimeEnv().TELEGRAM_ADMIN_IDS ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    );
    const role = adminIds.has(String(telegramUser.id)) ? "admin" : "user";
    const now = new Date().toISOString();
    const db = getDb();

    await db
      .insert(users)
      .values({
        id: userId,
        telegramId: String(telegramUser.id),
        displayName,
        username: telegramUser.username ?? null,
        languageCode: telegramUser.language_code ?? null,
        role,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          displayName,
          username: telegramUser.username ?? null,
          languageCode: telegramUser.language_code ?? null,
          role,
          updatedAt: now,
        },
      });

    await db
      .insert(subscriptions)
      .values({ userId, plan: "free", status: "active", updatedAt: now })
      .onConflictDoNothing({ target: subscriptions.userId });

    const currentSession = await getRequestSession(request).catch(() => null);
    if (currentSession?.userId === userId) {
      return Response.json(
        {
          user: {
            id: userId,
            displayName,
            username: telegramUser.username ?? null,
            plan: currentSession.plan,
            planExpiresAt: currentSession.planExpiresAt,
          },
        },
        { headers: { "cache-control": "no-store" } },
      );
    }

    await db.delete(sessions).where(lt(sessions.expiresAt, now));
    const sessionId = crypto.randomUUID();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000);
    await db.insert(sessions).values({
      id: sessionId,
      userId,
      expiresAt: expires.toISOString(),
    });

    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    return Response.json(
      {
        user: {
          id: userId,
          displayName,
          username: telegramUser.username ?? null,
          plan: subscription?.plan ?? "free",
          planExpiresAt: subscription?.expiresAt ?? null,
        },
      },
      {
        headers: {
          "set-cookie": sessionCookie(sessionId, request.url),
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Authentication failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
