import {
  Priority,
  Project,
  Status,
  Task,
  addDays,
  localDateKey,
} from "@/lib/planner-types";

export type SmartList =
  | "all"
  | "inbox"
  | "today"
  | "upcoming"
  | "overdue"
  | "completed";

export function parseLocalDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatTaskDate(dateKey: string | null) {
  if (!dateKey) return "Без срока";
  const today = localDateKey();
  if (dateKey === today) return "Сегодня";
  if (dateKey === addDays(today, 1)) return "Завтра";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(parseLocalDate(dateKey));
}

export function formatLongDate(dateKey: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(parseLocalDate(dateKey));
}

export function isTaskOverdue(task: Task) {
  return Boolean(
    task.dueDate &&
      task.dueDate < localDateKey() &&
      task.status !== "done" &&
      !task.deletedAt,
  );
}

export function getTasksForSmartList(tasks: Task[], smartList: SmartList) {
  const today = localDateKey();
  const weekEnd = addDays(today, 7);
  return tasks.filter((task) => {
    if (task.deletedAt) return false;
    if (smartList === "all") return true;
    if (smartList === "inbox") return task.status === "backlog";
    if (smartList === "today")
      return task.dueDate === today && task.status !== "done";
    if (smartList === "upcoming")
      return Boolean(
        task.dueDate &&
          task.dueDate > today &&
          task.dueDate <= weekEnd &&
          task.status !== "done",
      );
    if (smartList === "overdue") return isTaskOverdue(task);
    return task.status === "done";
  });
}

export function sortTasks(tasks: Task[]) {
  const priorityWeight: Record<Priority, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  return [...tasks].sort((left, right) => {
    if (left.status === "done" && right.status !== "done") return 1;
    if (left.status !== "done" && right.status === "done") return -1;
    if (left.dueDate && right.dueDate && left.dueDate !== right.dueDate) {
      return left.dueDate.localeCompare(right.dueDate);
    }
    if (left.dueDate && !right.dueDate) return -1;
    if (!left.dueDate && right.dueDate) return 1;
    const priorityDifference =
      priorityWeight[right.priority] - priorityWeight[left.priority];
    if (priorityDifference) return priorityDifference;
    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

export function parseQuickTask(
  raw: string,
  projects: Project[],
  fallbackProjectId: string | null,
) {
  let title = raw.trim();
  let dueDate: string | null = null;
  let priority: Priority = "medium";
  let projectId = fallbackProjectId ?? projects[0]?.id ?? null;

  const tags = [...title.matchAll(/#([\p{L}\p{N}_-]+)/gu)].map(
    (match) => match[1],
  );
  title = title.replace(/#[\p{L}\p{N}_-]+/gu, " ");

  const projectMatch = title.match(/@([\p{L}\p{N}_-]+)/u);
  if (projectMatch) {
    const needle = projectMatch[1].toLocaleLowerCase("ru");
    const project = projects.find(
      (candidate) =>
        candidate.name.toLocaleLowerCase("ru") === needle ||
        candidate.name.toLocaleLowerCase("ru").startsWith(needle),
    );
    if (project) projectId = project.id;
    title = title.replace(projectMatch[0], " ");
  }

  if (title.includes("/сегодня")) {
    dueDate = localDateKey();
    title = title.replace("/сегодня", " ");
  } else if (title.includes("/завтра")) {
    dueDate = addDays(localDateKey(), 1);
    title = title.replace("/завтра", " ");
  }
  const exactDate = title.match(/\/(\d{4}-\d{2}-\d{2})/);
  if (exactDate) {
    const candidate = exactDate[1];
    const parsed = parseLocalDate(candidate);
    if (!Number.isNaN(parsed.getTime()) && localDateKey(parsed) === candidate) {
      dueDate = candidate;
    }
    title = title.replace(exactDate[0], " ");
  }

  const priorityCommands: Array<[RegExp, Priority]> = [
    [/\/(?:критично|critical|🔥)/i, "critical"],
    [/\/(?:срочно|высокий|high)/i, "high"],
    [/\/(?:низкий|low)/i, "low"],
  ];
  for (const [pattern, value] of priorityCommands) {
    if (pattern.test(title)) {
      priority = value;
      title = title.replace(pattern, " ");
      break;
    }
  }

  return {
    title: title.replace(/\s+/g, " ").trim(),
    dueDate,
    priority,
    projectId,
    tags,
  };
}

export function statusLabel(status: Status) {
  return {
    backlog: "Входящие",
    "in-progress": "В работе",
    review: "Проверка",
    done: "Готово",
  }[status];
}

export function createMonthCells(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDayOffset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const numberOfDays = new Date(year, monthIndex + 1, 0).getDate();
  return [
    ...Array.from({ length: firstDayOffset }, () => null),
    ...Array.from({ length: numberOfDays }, (_, index) => {
      const date = new Date(year, monthIndex, index + 1);
      return { day: index + 1, dateKey: localDateKey(date) };
    }),
  ];
}
