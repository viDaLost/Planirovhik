import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { subscriptions, users } from "@/db/schema";
import { runtimeEnv } from "@/lib/runtime-env";
import { telegramApi } from "@/lib/server-auth";

type TelegramPaymentUpdate = {
  pre_checkout_query?: { id: string };
  message?: {
    from?: { id?: number };
    successful_payment?: {
      invoice_payload?: string;
      telegram_payment_charge_id?: string;
    };
  };
};

export async function POST(request: Request) {
  const expectedSecret = runtimeEnv().TELEGRAM_WEBHOOK_SECRET;
  const receivedSecret = request.headers.get(
    "x-telegram-bot-api-secret-token",
  );
  if (!expectedSecret || receivedSecret !== expectedSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = (await request.json()) as TelegramPaymentUpdate;
  if (update.pre_checkout_query?.id) {
    await telegramApi("answerPreCheckoutQuery", {
      pre_checkout_query_id: update.pre_checkout_query.id,
      ok: true,
    });
    return Response.json({ ok: true });
  }

  const payment = update.message?.successful_payment;
  const telegramId = update.message?.from?.id;
  if (
    payment &&
    telegramId &&
    payment.invoice_payload?.startsWith("premium:")
  ) {
    const db = getDb();
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.telegramId, String(telegramId)))
      .limit(1);
    if (user) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 31);
      await db
        .insert(subscriptions)
        .values({
          userId: user.id,
          plan: "premium",
          status: "active",
          source: "telegram-stars",
          expiresAt: expiresAt.toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: subscriptions.userId,
          set: {
            plan: "premium",
            status: "active",
            source: "telegram-stars",
            expiresAt: expiresAt.toISOString(),
            updatedAt: new Date().toISOString(),
          },
        });
    }
  }
  return Response.json({ ok: true });
}
