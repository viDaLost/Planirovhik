import { eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from "@/db";
import {
  preferences,
  projects,
  tasks,
} from "@/db/schema";
import {
  DEFAULT_PREFERENCES,
  PlannerSnapshotSchema,
  PreferencesSchema,
} from "@/lib/planner-types";
import { getRequestSession } from "@/lib/server-auth";

function safeJsonArray<T>(raw: string, fallback: T[] = []) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

export async function GET(request: Request) {
  try {
    const session = await getRequestSession(request);
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const db = getDb();
    const [projectRows, taskRows, preferenceRows] = await Promise.all([
      db.select().from(projects).where(eq(projects.userId, session.userId)),
      db.select().from(tasks).where(eq(tasks.userId, session.userId)),
      db
        .select()
        .from(preferences)
        .where(eq(preferences.userId, session.userId))
        .limit(1),
    ]);

    const parsedPreferences = PreferencesSchema.safeParse(
      preferenceRows[0]?.dataJson
        ? JSON.parse(preferenceRows[0].dataJson)
        : DEFAULT_PREFERENCES,
    );

    return Response.json(
      {
        snapshot: {
          version: 1,
          exportedAt: new Date().toISOString(),
          projects: projectRows.map((project) => ({
            id: project.id,
            name: project.name,
            color: project.color,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            deletedAt: project.deletedAt,
          })),
          tasks: taskRows.map((task) => ({
            id: task.id,
            projectId: task.projectId,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate,
            reminderAt: task.reminderAt,
            recurrence: task.recurrence,
            tags: safeJsonArray<string>(task.tagsJson),
            subtasks: safeJsonArray(task.subtasksJson),
            estimateMinutes: task.estimateMinutes,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
            deletedAt: task.deletedAt,
          })),
          preferences: parsedPreferences.success
            ? parsedPreferences.data
            : DEFAULT_PREFERENCES,
        },
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getRequestSession(request);
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 2_000_000) {
      return Response.json({ error: "Snapshot is too large" }, { status: 413 });
    }
    const parsed = PlannerSnapshotSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Snapshot validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const db = getDb();
    const writes: BatchItem<"sqlite">[] = [];
    for (const project of parsed.data.projects) {
      writes.push(
        db
          .insert(projects)
          .values({
            ...project,
            userId: session.userId,
          })
          .onConflictDoUpdate({
            target: projects.id,
            set: {
              name: project.name,
              color: project.color,
              updatedAt: project.updatedAt,
              deletedAt: project.deletedAt,
            },
            setWhere: eq(projects.userId, session.userId),
          }),
      );
    }

    for (const task of parsed.data.tasks) {
      writes.push(
        db
          .insert(tasks)
          .values({
            id: task.id,
            userId: session.userId,
            projectId: task.projectId,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate,
            reminderAt: task.reminderAt,
            recurrence: task.recurrence,
            tagsJson: JSON.stringify(task.tags),
            subtasksJson: JSON.stringify(task.subtasks),
            estimateMinutes: task.estimateMinutes,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
            deletedAt: task.deletedAt,
          })
          .onConflictDoUpdate({
            target: tasks.id,
            set: {
              projectId: task.projectId,
              title: task.title,
              description: task.description,
              status: task.status,
              priority: task.priority,
              dueDate: task.dueDate,
              reminderAt: task.reminderAt,
              recurrence: task.recurrence,
              tagsJson: JSON.stringify(task.tags),
              subtasksJson: JSON.stringify(task.subtasks),
              estimateMinutes: task.estimateMinutes,
              updatedAt: task.updatedAt,
              deletedAt: task.deletedAt,
              reminderSentAt: null,
            },
            setWhere: eq(tasks.userId, session.userId),
          }),
      );
    }

    const syncedAt = new Date().toISOString();
    writes.push(
      db
        .insert(preferences)
        .values({
          userId: session.userId,
          dataJson: JSON.stringify(parsed.data.preferences),
          updatedAt: syncedAt,
        })
        .onConflictDoUpdate({
          target: preferences.userId,
          set: {
            dataJson: JSON.stringify(parsed.data.preferences),
            updatedAt: syncedAt,
          },
        }),
    );

    // D1 executes each batch as a transaction. Chunking avoids thousands of
    // network round trips while keeping every batch comfortably sized.
    for (let index = 0; index < writes.length; index += 100) {
      const chunk = writes.slice(index, index + 100);
      if (chunk.length) {
        await db.batch(
          chunk as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]],
        );
      }
    }

    return Response.json({ syncedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
