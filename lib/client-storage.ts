import {
  DEFAULT_PREFERENCES,
  PlannerSnapshot,
  PlannerSnapshotSchema,
  Project,
  Task,
  addDays,
  localDateKey,
} from "@/lib/planner-types";

const DB_NAME = "planirov";
const STORE_NAME = "snapshots";
const SNAPSHOT_KEY = "current";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadLocalSnapshot() {
  const db = await openDatabase();
  return new Promise<PlannerSnapshot | null>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(SNAPSHOT_KEY);
    request.onsuccess = () => {
      const parsed = PlannerSnapshotSchema.safeParse(request.result);
      resolve(parsed.success ? parsed.data : null);
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function saveLocalSnapshot(snapshot: PlannerSnapshot) {
  const valid = PlannerSnapshotSchema.parse(snapshot);
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(valid, SNAPSHOT_KEY);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export async function clearLocalSnapshot() {
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(SNAPSHOT_KEY);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export function createDemoSnapshot(): PlannerSnapshot {
  const now = new Date().toISOString();
  const workId = crypto.randomUUID();
  const personalId = crypto.randomUUID();
  const projects: Project[] = [
    {
      id: workId,
      name: "Работа",
      color: "#5B5BD6",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: personalId,
      name: "Личное",
      color: "#0F9D7A",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
  ];
  const task = (
    title: string,
    projectId: string,
    status: Task["status"],
    priority: Task["priority"],
    dueDate: string | null,
    tags: string[],
    description = "",
  ): Task => ({
    id: crypto.randomUUID(),
    projectId,
    title,
    description,
    status,
    priority,
    dueDate,
    reminderAt: null,
    recurrence: "none",
    tags,
    subtasks: [],
    estimateMinutes: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });

  const today = localDateKey();
  const tasks: Task[] = [
    task(
      "Подготовить презентацию продукта",
      workId,
      "in-progress",
      "high",
      today,
      ["фокус", "презентация"],
      "Собрать итоговый сценарий и проверить цифры.",
    ),
    task(
      "Ответить на важные письма",
      workId,
      "backlog",
      "critical",
      today,
      ["коммуникации"],
    ),
    task(
      "Спланировать следующую неделю",
      workId,
      "review",
      "medium",
      addDays(today, 1),
      ["планирование"],
    ),
    task(
      "Записаться на тренировку",
      personalId,
      "backlog",
      "medium",
      addDays(today, 2),
      ["здоровье"],
    ),
    task(
      "Оплатить интернет",
      personalId,
      "done",
      "low",
      addDays(today, -1),
      ["дом"],
    ),
  ];
  tasks[0].subtasks = [
    { id: crypto.randomUUID(), title: "Проверить структуру", completed: true },
    { id: crypto.randomUUID(), title: "Добавить финальные цифры", completed: false },
  ];

  return {
    version: 1,
    exportedAt: now,
    projects,
    tasks,
    preferences: DEFAULT_PREFERENCES,
  };
}

function normalizeLegacyDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : null;
}

export function migrateLegacyLocalStorage(): PlannerSnapshot | null {
  const legacyKey = Object.keys(localStorage).find((key) =>
    key.startsWith("tp_v3_dataset_"),
  );
  if (!legacyKey) return null;
  try {
    const raw = JSON.parse(localStorage.getItem(legacyKey) ?? "{}") as {
      projects?: Array<{ id?: unknown; name?: unknown; color?: unknown }>;
      tasks?: Array<Record<string, unknown>>;
      uiPrefs?: { density?: unknown };
    };
    if (!Array.isArray(raw.projects) || !Array.isArray(raw.tasks)) return null;
    const now = new Date().toISOString();
    const projectMap = new Map<string, string>();
    const projects = raw.projects.slice(0, 200).map((project) => {
      const id = crypto.randomUUID();
      projectMap.set(String(project.id ?? ""), id);
      return {
        id,
        name:
          typeof project.name === "string"
            ? project.name.trim().slice(0, 80) || "Проект"
            : "Проект",
        color:
          typeof project.color === "string" &&
          /^#[0-9a-fA-F]{6}$/.test(project.color)
            ? project.color
            : "#5B5BD6",
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      } satisfies Project;
    });
    if (projects.length === 0) return null;

    const allowedStatuses = new Set([
      "backlog",
      "in-progress",
      "review",
      "done",
    ]);
    const allowedPriorities = new Set(["low", "medium", "high", "critical"]);
    const tasks = raw.tasks
      .slice(0, 5_000)
      .flatMap((legacy): Task[] => {
        const title =
          typeof legacy.title === "string"
            ? legacy.title.trim().slice(0, 240)
            : "";
        if (!title) return [];
        const status = allowedStatuses.has(String(legacy.status))
          ? (legacy.status as Task["status"])
          : legacy.completed
            ? "done"
            : "backlog";
        const priority = allowedPriorities.has(String(legacy.priority))
          ? (legacy.priority as Task["priority"])
          : "medium";
        return [
          {
            id: crypto.randomUUID(),
            projectId:
              projectMap.get(String(legacy.project ?? "")) ?? projects[0].id,
            title,
            description:
              typeof legacy.description === "string"
                ? legacy.description.trim().slice(0, 4_000)
                : "",
            status,
            priority,
            dueDate: normalizeLegacyDate(legacy.dueDate),
            reminderAt: null,
            recurrence: "none",
            tags: [],
            subtasks: [],
            estimateMinutes: null,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          },
        ];
      });

    return {
      version: 1,
      exportedAt: now,
      projects,
      tasks,
      preferences: {
        ...DEFAULT_PREFERENCES,
        density:
          raw.uiPrefs?.density === "compact" ? "compact" : "comfortable",
      },
    };
  } catch {
    return null;
  }
}

export function mergeSnapshots(
  local: PlannerSnapshot,
  remote: PlannerSnapshot,
): PlannerSnapshot {
  const mergeByUpdatedAt = <T extends { id: string; updatedAt: string }>(
    left: T[],
    right: T[],
  ) => {
    const map = new Map(left.map((item) => [item.id, item]));
    for (const item of right) {
      const current = map.get(item.id);
      if (!current || item.updatedAt > current.updatedAt) map.set(item.id, item);
    }
    return [...map.values()];
  };
  return PlannerSnapshotSchema.parse({
    version: 1,
    exportedAt: new Date().toISOString(),
    projects: mergeByUpdatedAt(local.projects, remote.projects),
    tasks: mergeByUpdatedAt(local.tasks, remote.tasks),
    preferences: remote.preferences ?? local.preferences,
  });
}
