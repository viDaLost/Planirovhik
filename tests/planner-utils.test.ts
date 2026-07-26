import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PlannerSnapshotSchema,
  Task,
  addDays,
  localDateKey,
  nextRecurringDate,
} from "@/lib/planner-types";
import {
  createMonthCells,
  getTasksForSmartList,
  parseQuickTask,
} from "@/lib/planner-utils";
import { mergeSnapshots } from "@/lib/client-storage";

const PROJECT_ID = "00000000-0000-4000-8000-000000000001";
const TASK_ID = "00000000-0000-4000-8000-000000000002";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: TASK_ID,
    projectId: PROJECT_ID,
    title: "Проверить отчёт",
    description: "",
    status: "backlog",
    priority: "medium",
    dueDate: "2026-07-26",
    reminderAt: null,
    recurrence: "none",
    tags: [],
    subtasks: [],
    estimateMinutes: null,
    createdAt: "2026-07-26T10:00:00.000Z",
    updatedAt: "2026-07-26T10:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("быстрое создание задачи", () => {
  it("разбирает русские команды, тег, проект и приоритет", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T12:00:00.000Z"));
    const parsed = parseQuickTask(
      "Подготовить релиз /завтра /срочно #запуск @Работа",
      [
        {
          id: PROJECT_ID,
          name: "Работа",
          color: "#5B5BD6",
          createdAt: "2026-07-26T10:00:00.000Z",
          updatedAt: "2026-07-26T10:00:00.000Z",
          deletedAt: null,
        },
      ],
      null,
    );

    expect(parsed).toEqual({
      title: "Подготовить релиз",
      dueDate: addDays(localDateKey(), 1),
      priority: "high",
      projectId: PROJECT_ID,
      tags: ["запуск"],
    });
  });

  it("игнорирует невозможную дату", () => {
    const parsed = parseQuickTask(
      "Проверка /2026-02-31",
      [],
      null,
    );
    expect(parsed.title).toBe("Проверка");
    expect(parsed.dueDate).toBeNull();
  });
});

describe("повторения и календарь", () => {
  it("корректно ограничивает месячное повторение последним днём месяца", () => {
    expect(nextRecurringDate("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(nextRecurringDate("2028-01-31", "monthly")).toBe("2028-02-29");
  });

  it("строит февраль високосного года", () => {
    const cells = createMonthCells(new Date(2028, 1, 1)).filter(Boolean);
    expect(cells).toHaveLength(29);
    expect(cells.at(-1)?.dateKey).toBe("2028-02-29");
  });
});

describe("валидация и синхронизация", () => {
  it("показывает выполненные задачи в полном списке и скрывает их в «Сегодня»", () => {
    const done = task({ status: "done" });
    expect(getTasksForSmartList([done], "all")).toHaveLength(1);
    expect(getTasksForSmartList([done], "today")).toHaveLength(0);
  });

  it("отклоняет повреждённую резервную копию", () => {
    const parsed = PlannerSnapshotSchema.safeParse({
      version: 1,
      exportedAt: "not-a-date",
      projects: [],
      tasks: [{ title: "" }],
      preferences: {},
    });
    expect(parsed.success).toBe(false);
  });

  it("при конфликте сохраняет более новую tombstone-версию", () => {
    const local = {
      version: 1 as const,
      exportedAt: "2026-07-26T10:00:00.000Z",
      projects: [],
      tasks: [task()],
      preferences: {
        theme: "system" as const,
        density: "comfortable" as const,
        weekStartsOn: 1 as const,
        defaultView: "list" as const,
      },
    };
    const remote = {
      ...local,
      exportedAt: "2026-07-26T12:00:00.000Z",
      tasks: [
        task({
          deletedAt: "2026-07-26T11:00:00.000Z",
          updatedAt: "2026-07-26T11:00:00.000Z",
        }),
      ],
    };

    const merged = mergeSnapshots(local, remote);
    expect(merged.tasks[0].deletedAt).toBe("2026-07-26T11:00:00.000Z");
  });
});
