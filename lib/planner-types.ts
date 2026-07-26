import { z } from "zod";

export const STATUS_OPTIONS = [
  { id: "backlog", label: "Входящие", short: "Входящие" },
  { id: "in-progress", label: "В работе", short: "Работа" },
  { id: "review", label: "Проверка", short: "Проверка" },
  { id: "done", label: "Готово", short: "Готово" },
] as const;

export const PRIORITY_OPTIONS = [
  { id: "low", label: "Низкий" },
  { id: "medium", label: "Средний" },
  { id: "high", label: "Высокий" },
  { id: "critical", label: "Критичный" },
] as const;

export const RECURRENCE_OPTIONS = [
  { id: "none", label: "Не повторять" },
  { id: "daily", label: "Каждый день" },
  { id: "weekly", label: "Каждую неделю" },
  { id: "monthly", label: "Каждый месяц" },
] as const;

export const StatusSchema = z.enum([
  "backlog",
  "in-progress",
  "review",
  "done",
]);
export const PrioritySchema = z.enum(["low", "medium", "high", "critical"]);
export const RecurrenceSchema = z.enum(["none", "daily", "weekly", "monthly"]);

const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();
const IsoDateTimeSchema = z.string().datetime().nullable();
const ColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const SubtaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  completed: z.boolean(),
});

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  color: ColorSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: IsoDateTimeSchema.optional().default(null),
});

export const TaskSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(4_000).default(""),
  status: StatusSchema,
  priority: PrioritySchema,
  dueDate: IsoDateSchema,
  reminderAt: IsoDateTimeSchema,
  recurrence: RecurrenceSchema,
  tags: z
    .array(z.string().trim().min(1).max(32))
    .max(20)
    .transform((tags) => [...new Set(tags)]),
  subtasks: z.array(SubtaskSchema).max(100),
  estimateMinutes: z.number().int().min(5).max(24 * 60).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: IsoDateTimeSchema.optional().default(null),
});

export const PreferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system", "sunset", "forest"]).default("system"),
  density: z.enum(["comfortable", "compact"]).default("comfortable"),
  weekStartsOn: z.literal(1).default(1),
  defaultView: z
    .enum(["list", "board", "calendar", "analytics"])
    .default("list"),
});

export const PlannerSnapshotSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  projects: z.array(ProjectSchema).max(200),
  tasks: z.array(TaskSchema).max(5_000),
  preferences: PreferencesSchema,
});

export type Status = z.infer<typeof StatusSchema>;
export type Priority = z.infer<typeof PrioritySchema>;
export type Recurrence = z.infer<typeof RecurrenceSchema>;
export type Subtask = z.infer<typeof SubtaskSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Preferences = z.infer<typeof PreferencesSchema>;
export type PlannerSnapshot = z.infer<typeof PlannerSnapshotSchema>;

export type Plan = "free" | "premium" | "team";
export type SessionUser = {
  id: string;
  displayName: string;
  username: string | null;
  plan: Plan;
  planExpiresAt: string | null;
};

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "system",
  density: "comfortable",
  weekStartsOn: 1,
  defaultView: "list",
};

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function nextRecurringDate(
  dueDate: string | null,
  recurrence: Recurrence,
) {
  if (!dueDate || recurrence === "none") return null;
  if (recurrence === "daily") return addDays(dueDate, 1);
  if (recurrence === "weekly") return addDays(dueDate, 7);
  const [year, month, day] = dueDate.split("-").map(Number);
  const next = new Date(year, month, 1);
  const lastDay = new Date(
    next.getFullYear(),
    next.getMonth() + 1,
    0,
  ).getDate();
  next.setDate(Math.min(day, lastDay));
  return localDateKey(next);
}

export function createEmptySnapshot(): PlannerSnapshot {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    projects: [],
    tasks: [],
    preferences: DEFAULT_PREFERENCES,
  };
}
