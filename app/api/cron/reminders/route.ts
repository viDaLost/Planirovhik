import { and, eq, isNull, lte, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { tasks, users } from "@/db/schema";
import { runtimeEnv } from "@/lib/runtime-env";
import { telegramApi } from "@/lib/server-auth";

export async function POST(request: Request) {
  const secret = runtimeEnv().CRON_SECRET;
  if (
    !secret ||
    request.headers.get("authorization") !== `Bearer ${secret}`
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const now = new Date().toISOString();
  const due = await db
    .select({
      taskId: tasks.id,
      title: tasks.title,
      dueDate: tasks.dueDate,
      telegramId: users.telegramId,
    })
    .from(tasks)
    .innerJoin(users, eq(tasks.userId, users.id))
    .where(
      and(
        lte(tasks.reminderAt, now),
        isNull(tasks.reminderSentAt),
        isNull(tasks.deletedAt),
        ne(tasks.status, "done"),
      ),
    )
    .limit(100);

  let delivered = 0;
  for (const reminder of due) {
    try {
      await telegramApi("sendMessage", {
        chat_id: reminder.telegramId,
        text: `⏰ ${reminder.title}${reminder.dueDate ? `\nСрок: ${reminder.dueDate}` : ""}`,
      });
      await db
        .update(tasks)
        .set({ reminderSentAt: now })
        .where(eq(tasks.id, reminder.taskId));
      delivered += 1;
    } catch {
      // Keep the reminder unsent so the scheduler can retry later.
    }
  }

  return Response.json({ checked: due.length, delivered });
}
