"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  ArchiveRestore,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Cloud,
  CloudOff,
  Download,
  Folder,
  FolderPlus,
  Inbox,
  LayoutDashboard,
  List,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { AnalyticsView } from "@/app/components/AnalyticsView";
import { BoardView } from "@/app/components/BoardView";
import { CalendarView } from "@/app/components/CalendarView";
import { Dialog } from "@/app/components/Dialog";
import { TaskCard } from "@/app/components/TaskCard";
import { TaskEditor } from "@/app/components/TaskEditor";
import {
  clearLocalSnapshot,
  createDemoSnapshot,
  loadLocalSnapshot,
  mergeSnapshots,
  migrateLegacyLocalStorage,
  saveLocalSnapshot,
} from "@/lib/client-storage";
import {
  PlannerSnapshot,
  PlannerSnapshotSchema,
  Priority,
  Project,
  SessionUser,
  Status,
  Task,
  localDateKey,
  nextRecurringDate,
} from "@/lib/planner-types";
import {
  SmartList,
  formatLongDate,
  getTasksForSmartList,
  isTaskOverdue,
  parseQuickTask,
  sortTasks,
} from "@/lib/planner-utils";

type View = "list" | "board" | "calendar" | "analytics";
type SyncState = "local" | "syncing" | "synced" | "offline" | "error";
type ToastState = {
  message: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: "success" | "warning" | "error";
};

const PROJECT_COLORS = [
  "#5B5BD6",
  "#0F9D7A",
  "#E85D75",
  "#F59E0B",
  "#0EA5E9",
  "#8B5CF6",
  "#64748B",
];

const STATIC_BUILD =
  typeof document !== "undefined" &&
  document.documentElement.dataset.staticMode === "true";

const SMART_LISTS: Array<{
  id: SmartList;
  label: string;
  icon: typeof Inbox;
}> = [
  { id: "all", label: "Все задачи", icon: LayoutDashboard },
  { id: "inbox", label: "Входящие", icon: Inbox },
  { id: "today", label: "Сегодня", icon: CalendarDays },
  { id: "upcoming", label: "Следующие 7 дней", icon: ChevronRight },
  { id: "overdue", label: "Просрочено", icon: AlertTriangle },
  { id: "completed", label: "Выполнено", icon: CheckCircle2 },
];

function haptic(type: "light" | "medium" | "success" | "error" = "light") {
  const feedback = window.Telegram?.WebApp?.HapticFeedback;
  if (type === "success" || type === "error") {
    feedback?.notificationOccurred?.(type);
  } else {
    feedback?.impactOccurred?.(type);
  }
}

function newTask(
  projectId: string | null,
  dueDate: string | null = null,
): Task {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectId,
    title: "",
    description: "",
    status: "backlog",
    priority: "medium",
    dueDate,
    reminderAt: null,
    recurrence: "none",
    tags: [],
    subtasks: [],
    estimateMinutes: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

function downloadJson(snapshot: PlannerSnapshot) {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `planirov-backup-${localDateKey()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function PlannerApp() {
  const [snapshot, setSnapshot] = useState<PlannerSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("local");
  const [view, setView] = useState<View>("list");
  const [smartList, setSmartList] = useState<SmartList>("today");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [quickTask, setQuickTask] = useState("");
  const [editorTask, setEditorTask] = useState<Task | null>(null);
  const [editorIsNew, setEditorIsNew] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectColor, setProjectColor] = useState(PROJECT_COLORS[0]);
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [importCandidate, setImportCandidate] =
    useState<PlannerSnapshot | null>(null);
  const [resetPhrase, setResetPhrase] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const skipFirstSyncRef = useRef(true);

  const activeProjects = useMemo(
    () => snapshot?.projects.filter((project) => !project.deletedAt) ?? [],
    [snapshot?.projects],
  );
  const allTasks = useMemo(
    () => snapshot?.tasks.filter((task) => !task.deletedAt) ?? [],
    [snapshot?.tasks],
  );
  const hasPremiumAccess = !sessionUser || sessionUser.plan !== "free";

  const showToast = useCallback((nextToast: ToastState) => {
    setToast(nextToast);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6_000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      window.Telegram?.WebApp?.ready?.();
      window.Telegram?.WebApp?.expand?.();

      let local =
        (await loadLocalSnapshot().catch(() => null)) ??
        migrateLegacyLocalStorage() ??
        createDemoSnapshot();
      if (!cancelled) {
        setSnapshot(local);
        setView(local.preferences.defaultView);
        setReady(true);
      }
      await saveLocalSnapshot(local).catch(() => undefined);

      if (STATIC_BUILD) {
        if (!cancelled) setSyncState(navigator.onLine ? "local" : "offline");
        return;
      }

      try {
        const initData = window.Telegram?.WebApp?.initData;
        const authResponse = await fetch(
          initData ? "/api/auth/telegram" : "/api/auth/session",
          initData
            ? {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ initData }),
              }
            : undefined,
        );
        if (!authResponse.ok || cancelled) return;
        const auth = (await authResponse.json()) as { user: SessionUser };
        setSessionUser(auth.user);
        setSyncState("syncing");

        const remoteResponse = await fetch("/api/sync", {
          headers: { accept: "application/json" },
        });
        if (remoteResponse.ok) {
          const payload = (await remoteResponse.json()) as {
            snapshot: PlannerSnapshot;
          };
          const parsed = PlannerSnapshotSchema.safeParse(payload.snapshot);
          if (parsed.success && !cancelled) {
            local = mergeSnapshots(local, parsed.data);
            setSnapshot(local);
            await saveLocalSnapshot(local);
          }
        }
        if (!cancelled) {
          skipFirstSyncRef.current = false;
          setSyncState("synced");
        }
      } catch {
        if (!cancelled) setSyncState(navigator.onLine ? "error" : "offline");
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!snapshot || !ready) return;
    const timer = window.setTimeout(() => {
      void saveLocalSnapshot(snapshot).catch(() =>
        setSyncState((current) =>
          current === "synced" ? "error" : current,
        ),
      );
    }, 180);
    return () => window.clearTimeout(timer);
  }, [ready, snapshot]);

  useEffect(() => {
    if (!snapshot || !sessionUser || skipFirstSyncRef.current) return;
    const timer = window.setTimeout(async () => {
      if (!navigator.onLine) {
        setSyncState("offline");
        return;
      }
      setSyncState("syncing");
      try {
        const response = await fetch("/api/sync", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(snapshot),
        });
        setSyncState(response.ok ? "synced" : "error");
      } catch {
        setSyncState("offline");
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [sessionUser, snapshot]);

  useEffect(() => {
    function updateOnlineState() {
      setSyncState(
        navigator.onLine && !STATIC_BUILD
          ? sessionUser
            ? "syncing"
            : "local"
          : navigator.onLine
            ? "local"
            : "offline",
      );
    }
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, [sessionUser]);

  useEffect(() => {
    if (
      (STATIC_BUILD || process.env.NODE_ENV === "production") &&
      "serviceWorker" in navigator
    ) {
      const workerUrl = new URL("sw.js", document.baseURI);
      void navigator.serviceWorker
        .register(workerUrl.href, {
          scope: new URL("./", workerUrl).pathname,
        })
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!snapshot) return;
    document.documentElement.dataset.theme = snapshot.preferences.theme;
    document.documentElement.dataset.density = snapshot.preferences.density;
  }, [snapshot]);

  const openNewTask = useCallback(
    (dueDate: string | null = null) => {
      const defaultProject =
        projectFilter !== "all"
          ? projectFilter
          : activeProjects[0]?.id ?? null;
      const defaultDate =
        dueDate ?? (smartList === "today" ? localDateKey() : null);
      setEditorTask(newTask(defaultProject, defaultDate));
      setEditorIsNew(true);
      setSelectedDay(null);
      haptic("light");
    },
    [activeProjects, projectFilter, smartList],
  );

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const isTyping =
        target.matches("input, textarea, select") ||
        target.getAttribute("contenteditable") === "true";
      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (
        event.key.toLowerCase() === "n" &&
        !isTyping &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        event.preventDefault();
        openNewTask();
      }
    }
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, [openNewTask]);

  const visibleTasks = useMemo(() => {
    const base = getTasksForSmartList(allTasks, smartList).filter((task) => {
      if (projectFilter !== "all" && task.projectId !== projectFilter) {
        return false;
      }
      if (priorityFilter !== "all" && task.priority !== priorityFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const needle = searchQuery.trim().toLocaleLowerCase("ru");
        const project = activeProjects.find(
          (candidate) => candidate.id === task.projectId,
        );
        const haystack = [
          task.title,
          task.description,
          task.tags.join(" "),
          project?.name ?? "",
        ]
          .join(" ")
          .toLocaleLowerCase("ru");
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
    return sortTasks(base);
  }, [
    activeProjects,
    allTasks,
    priorityFilter,
    projectFilter,
    searchQuery,
    smartList,
  ]);

  const statistics = useMemo(
    () => ({
      total: allTasks.length,
      today: allTasks.filter(
        (task) => task.dueDate === localDateKey() && task.status !== "done",
      ).length,
      active: allTasks.filter((task) => task.status === "in-progress").length,
      overdue: allTasks.filter(isTaskOverdue).length,
      done: allTasks.filter((task) => task.status === "done").length,
    }),
    [allTasks],
  );

  function commit(
    recipe: (current: PlannerSnapshot) => PlannerSnapshot,
  ) {
    setSnapshot((current) => {
      if (!current) return current;
      return PlannerSnapshotSchema.parse({
        ...recipe(current),
        exportedAt: new Date().toISOString(),
      });
    });
  }

  function saveTask(task: Task) {
    const wasExisting = snapshot?.tasks.some(
      (candidate) => candidate.id === task.id,
    );
    commit((current) => ({
      ...current,
      tasks: wasExisting
        ? current.tasks.map((candidate) =>
            candidate.id === task.id ? task : candidate,
          )
        : [task, ...current.tasks],
    }));
    setEditorTask(null);
    haptic("success");
    showToast({
      message: wasExisting ? "Задача обновлена" : "Задача создана",
      tone: "success",
    });
  }

  function changeStatus(task: Task, status: Status) {
    const now = new Date().toISOString();
    const next = { ...task, status, updatedAt: now };
    let recurringTask: Task | null = null;
    if (
      status === "done" &&
      task.status !== "done" &&
      task.recurrence !== "none"
    ) {
      const nextDate = nextRecurringDate(task.dueDate, task.recurrence);
      if (nextDate) {
        recurringTask = {
          ...task,
          id: crypto.randomUUID(),
          status: "backlog",
          dueDate: nextDate,
          reminderAt: null,
          subtasks: task.subtasks.map((subtask) => ({
            ...subtask,
            id: crypto.randomUUID(),
            completed: false,
          })),
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };
      }
    }
    commit((current) => ({
      ...current,
      tasks: [
        ...(recurringTask ? [recurringTask] : []),
        ...current.tasks.map((candidate) =>
          candidate.id === task.id ? next : candidate,
        ),
      ],
    }));
    haptic(status === "done" ? "success" : "light");
  }

  function toggleSubtask(task: Task, subtaskId: string) {
    commit((current) => ({
      ...current,
      tasks: current.tasks.map((candidate) =>
        candidate.id === task.id
          ? {
              ...candidate,
              subtasks: candidate.subtasks.map((subtask) =>
                subtask.id === subtaskId
                  ? { ...subtask, completed: !subtask.completed }
                  : subtask,
              ),
              updatedAt: new Date().toISOString(),
            }
          : candidate,
      ),
    }));
  }

  function deleteTask(task: Task) {
    const deletedAt = new Date().toISOString();
    commit((current) => ({
      ...current,
      tasks: current.tasks.map((candidate) =>
        candidate.id === task.id
          ? { ...candidate, deletedAt, updatedAt: deletedAt }
          : candidate,
      ),
    }));
    setEditorTask(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(task.id);
      return next;
    });
    haptic("medium");
    showToast({
      message: "Задача перемещена в архив",
      detail: task.title,
      tone: "warning",
      actionLabel: "Отменить",
      onAction: () => {
        commit((current) => ({
          ...current,
          tasks: current.tasks.map((candidate) =>
            candidate.id === task.id
              ? {
                  ...candidate,
                  deletedAt: null,
                  updatedAt: new Date().toISOString(),
                }
              : candidate,
          ),
        }));
        haptic("success");
      },
    });
  }

  function createQuickTask(event: FormEvent) {
    event.preventDefault();
    if (!quickTask.trim()) return;
    const parsed = parseQuickTask(
      quickTask,
      activeProjects,
      projectFilter === "all" ? null : projectFilter,
    );
    if (!parsed.title) {
      showToast({
        message: "Добавьте название задачи",
        tone: "error",
      });
      return;
    }
    const task = newTask(parsed.projectId, parsed.dueDate);
    task.title = parsed.title;
    task.priority = parsed.priority;
    task.tags = parsed.tags;
    saveTask(task);
    setQuickTask("");
  }

  function openProjectDialog(project: Project | null = null) {
    setEditingProject(project);
    setProjectName(project?.name ?? "");
    setProjectColor(project?.color ?? PROJECT_COLORS[0]);
    setProjectDialogOpen(true);
  }

  function closeProjectDialog() {
    setProjectDialogOpen(false);
    setEditingProject(null);
    setProjectName("");
  }

  function saveProject(event: FormEvent) {
    event.preventDefault();
    const name = projectName.trim();
    if (!name) return;
    const now = new Date().toISOString();
    if (editingProject) {
      commit((current) => ({
        ...current,
        projects: current.projects.map((project) =>
          project.id === editingProject.id
            ? {
                ...project,
                name: name.slice(0, 80),
                color: projectColor,
                updatedAt: now,
              }
            : project,
        ),
      }));
      closeProjectDialog();
      showToast({
        message: `Проект «${name.slice(0, 80)}» обновлён`,
        tone: "success",
      });
      return;
    }
    const project: Project = {
      id: crypto.randomUUID(),
      name: name.slice(0, 80),
      color: projectColor,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    commit((current) => ({
      ...current,
      projects: [...current.projects, project],
    }));
    setProjectColor(
      PROJECT_COLORS[(activeProjects.length + 1) % PROJECT_COLORS.length],
    );
    closeProjectDialog();
    setProjectFilter(project.id);
    showToast({ message: `Проект «${project.name}» создан`, tone: "success" });
  }

  function deleteProject(project: Project) {
    const fallback =
      activeProjects.find((candidate) => candidate.id !== project.id)?.id ??
      null;
    const now = new Date().toISOString();
    commit((current) => ({
      ...current,
      projects: current.projects.map((candidate) =>
        candidate.id === project.id
          ? { ...candidate, deletedAt: now, updatedAt: now }
          : candidate,
      ),
      tasks: current.tasks.map((task) =>
        task.projectId === project.id
          ? { ...task, projectId: fallback, updatedAt: now }
          : task,
      ),
    }));
    if (projectFilter === project.id) setProjectFilter("all");
    showToast({
      message: `Проект «${project.name}» архивирован`,
      actionLabel: "Отменить",
      onAction: () =>
        commit((current) => ({
          ...current,
          projects: current.projects.map((candidate) =>
            candidate.id === project.id
              ? {
                  ...candidate,
                  deletedAt: null,
                  updatedAt: new Date().toISOString(),
                }
              : candidate,
          ),
          tasks: current.tasks.map((task) =>
            task.updatedAt === now && task.projectId === fallback
              ? {
                  ...task,
                  projectId: project.id,
                  updatedAt: new Date().toISOString(),
                }
              : task,
          ),
        })),
    });
  }

  function setPreference<K extends keyof PlannerSnapshot["preferences"]>(
    key: K,
    value: PlannerSnapshot["preferences"][K],
  ) {
    commit((current) => ({
      ...current,
      preferences: { ...current.preferences, [key]: value },
    }));
  }

  function toggleSelected(taskId: string, selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  }

  function bulkSetStatus(status: Status) {
    const now = new Date().toISOString();
    commit((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        selectedIds.has(task.id) ? { ...task, status, updatedAt: now } : task,
      ),
    }));
    setSelectedIds(new Set());
    setBulkMode(false);
    showToast({ message: "Выбранные задачи обновлены", tone: "success" });
  }

  function bulkDelete() {
    const deletedAt = new Date().toISOString();
    const ids = new Set(selectedIds);
    commit((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        ids.has(task.id)
          ? { ...task, deletedAt, updatedAt: deletedAt }
          : task,
      ),
    }));
    setSelectedIds(new Set());
    setBulkMode(false);
    showToast({
      message: `В архив перемещено задач: ${ids.size}`,
      actionLabel: "Отменить",
      onAction: () =>
        commit((current) => ({
          ...current,
          tasks: current.tasks.map((task) =>
            ids.has(task.id)
              ? {
                  ...task,
                  deletedAt: null,
                  updatedAt: new Date().toISOString(),
                }
              : task,
          ),
        })),
    });
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 2_000_000) {
      showToast({ message: "Файл превышает 2 МБ", tone: "error" });
      return;
    }
    try {
      const raw = JSON.parse(await file.text());
      const parsed = PlannerSnapshotSchema.safeParse(raw);
      if (!parsed.success) throw new Error("invalid");
      setImportCandidate(parsed.data);
    } catch {
      showToast({
        message: "Не удалось импортировать файл",
        detail: "Проверьте формат резервной копии.",
        tone: "error",
      });
    }
  }

  function applyImport() {
    if (!importCandidate) return;
    if (snapshot) downloadJson(snapshot);
    const now = new Date().toISOString();
    const importedProjectIds = new Set(
      importCandidate.projects.map((project) => project.id),
    );
    const importedTaskIds = new Set(
      importCandidate.tasks.map((task) => task.id),
    );
    setSnapshot({
      ...importCandidate,
      exportedAt: now,
      projects: [
        ...importCandidate.projects,
        ...(snapshot?.projects ?? [])
          .filter((project) => !importedProjectIds.has(project.id))
          .map((project) => ({
            ...project,
            deletedAt: now,
            updatedAt: now,
          })),
      ],
      tasks: [
        ...importCandidate.tasks,
        ...(snapshot?.tasks ?? [])
          .filter((task) => !importedTaskIds.has(task.id))
          .map((task) => ({
            ...task,
            deletedAt: now,
            updatedAt: now,
          })),
      ],
    });
    setImportCandidate(null);
    setSettingsOpen(false);
    showToast({
      message: "Данные импортированы",
      detail: "Предыдущая версия автоматически скачана.",
      tone: "success",
    });
  }

  async function resetAllData() {
    if (resetPhrase !== "УДАЛИТЬ") return;
    const now = new Date().toISOString();
    const demo = createDemoSnapshot();
    const clean: PlannerSnapshot = {
      ...demo,
      projects: [
        ...demo.projects,
        ...(snapshot?.projects ?? []).map((project) => ({
          ...project,
          deletedAt: now,
          updatedAt: now,
        })),
      ],
      tasks: [
        ...demo.tasks,
        ...(snapshot?.tasks ?? []).map((task) => ({
          ...task,
          deletedAt: now,
          updatedAt: now,
        })),
      ],
    };
    await clearLocalSnapshot().catch(() => undefined);
    setSnapshot(clean);
    setResetPhrase("");
    setSettingsOpen(false);
    showToast({ message: "Данные сброшены", tone: "warning" });
  }

  async function startCheckout() {
    try {
      const response = await fetch("/api/subscription/checkout");
      const body = (await response.json()) as {
        invoiceUrl?: string;
        error?: string;
      };
      if (!response.ok || !body.invoiceUrl) {
        throw new Error(body.error ?? "Checkout unavailable");
      }
      if (window.Telegram?.WebApp?.openInvoice) {
        window.Telegram.WebApp.openInvoice(body.invoiceUrl, (status) => {
          if (status === "paid") {
            showToast({
              message: "Оплата принята",
              detail: "Статус обновится после подтверждения Telegram.",
              tone: "success",
            });
          }
        });
      } else {
        window.location.assign(body.invoiceUrl);
      }
    } catch {
      showToast({
        message: "Оплата пока не настроена",
        detail: "Добавьте invoice URL в переменные окружения.",
        tone: "warning",
      });
    }
  }

  const currentSmartList =
    SMART_LISTS.find((item) => item.id === smartList) ?? SMART_LISTS[0];
  const dayTasks = selectedDay
    ? sortTasks(allTasks.filter((task) => task.dueDate === selectedDay))
    : [];

  if (!ready || !snapshot) {
    return (
      <main className="loading-screen" aria-live="polite">
        <span className="brand-mark">
          <Check aria-hidden="true" />
        </span>
        <p>Готовим ваше пространство…</p>
      </main>
    );
  }

  return (
    <main className="planner-app">
      <a className="skip-link" href="#planner-content">
        Перейти к задачам
      </a>

      <aside className={`sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-top">
          <div className="brand">
            <span className="brand-mark">
              <Check aria-hidden="true" />
            </span>
            <div>
              <strong>Planirov</strong>
              <span>Спокойный план на день</span>
            </div>
            <button
              className="icon-button sidebar-close"
              type="button"
              aria-label="Закрыть меню"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X aria-hidden="true" />
            </button>
          </div>

          <button
            className="primary-button sidebar-create"
            type="button"
            onClick={() => openNewTask()}
          >
            <Plus aria-hidden="true" size={18} />
            Новая задача
            <kbd>N</kbd>
          </button>

          <nav className="sidebar-nav" aria-label="Умные списки">
            <span className="nav-caption">Обзор</span>
            {SMART_LISTS.map((item) => {
              const Icon = item.icon;
              const count =
                item.id === "overdue"
                  ? statistics.overdue
                  : item.id === "today"
                    ? statistics.today
                    : item.id === "completed"
                      ? statistics.done
                      : undefined;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={smartList === item.id ? "active" : ""}
                  aria-current={smartList === item.id ? "page" : undefined}
                  onClick={() => {
                    setSmartList(item.id);
                    setView("list");
                    setMobileMenuOpen(false);
                  }}
                >
                  <Icon aria-hidden="true" size={18} />
                  <span>{item.label}</span>
                  {count ? <em>{count}</em> : null}
                </button>
              );
            })}
          </nav>

          <nav className="sidebar-nav projects-nav" aria-label="Проекты">
            <div className="nav-caption-row">
              <span className="nav-caption">Проекты</span>
              <button
                className="icon-button compact"
                type="button"
                aria-label="Создать проект"
                onClick={() => openProjectDialog()}
              >
                <Plus aria-hidden="true" size={16} />
              </button>
            </div>
            <button
              type="button"
              className={projectFilter === "all" ? "active" : ""}
              onClick={() => setProjectFilter("all")}
            >
              <Folder aria-hidden="true" size={18} />
              <span>Все проекты</span>
            </button>
            {activeProjects.map((project) => (
              <button
                key={project.id}
                type="button"
                className={projectFilter === project.id ? "active" : ""}
                onClick={() => {
                  setProjectFilter(project.id);
                  setMobileMenuOpen(false);
                }}
              >
                <i
                  className="project-dot"
                  style={{ backgroundColor: project.color }}
                  aria-hidden="true"
                />
                <span>{project.name}</span>
                <em>
                  {
                    allTasks.filter(
                      (task) =>
                        task.projectId === project.id &&
                        task.status !== "done",
                    ).length
                  }
                </em>
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className={`sync-status sync-${syncState}`} aria-live="polite">
            {syncState === "offline" || syncState === "error" ? (
              <CloudOff aria-hidden="true" size={16} />
            ) : syncState === "syncing" ? (
              <RefreshCw className="spin" aria-hidden="true" size={16} />
            ) : (
              <Cloud aria-hidden="true" size={16} />
            )}
            <span>
              {{
                local: "Сохранено на устройстве",
                syncing: "Синхронизация…",
                synced: "Данные синхронизированы",
                offline: "Офлайн — изменения в очереди",
                error: "Не удалось синхронизировать",
              }[syncState]}
            </span>
          </div>
          <button
            className="profile-button"
            type="button"
            onClick={() => setSettingsOpen(true)}
          >
            <span>
              <CircleUserRound aria-hidden="true" size={21} />
            </span>
            <div>
              <strong>{sessionUser?.displayName ?? "Локальный профиль"}</strong>
              <small>
                {sessionUser
                  ? `${sessionUser.plan === "free" ? "Free" : sessionUser.plan} · Telegram`
                  : "Гостевой режим"}
              </small>
            </div>
            <Settings aria-hidden="true" size={18} />
          </button>
        </div>
      </aside>

      {mobileMenuOpen ? (
        <button
          className="mobile-sidebar-backdrop"
          type="button"
          aria-label="Закрыть меню"
          onClick={() => setMobileMenuOpen(false)}
        />
      ) : null}

      <section className="content-shell" id="planner-content">
        <header className="mobile-header">
          <button
            className="icon-button"
            type="button"
            aria-label="Открыть меню"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu aria-hidden="true" />
          </button>
          <div className="mobile-brand">
            <span className="brand-mark">
              <Check aria-hidden="true" />
            </span>
            <strong>Planirov</strong>
          </div>
          <button
            className="icon-button primary-icon"
            type="button"
            aria-label="Создать задачу"
            onClick={() => openNewTask()}
          >
            <Plus aria-hidden="true" />
          </button>
        </header>

        <header className="page-header">
          <div>
            <span className="eyebrow">Моё пространство</span>
            <h1>{currentSmartList.label}</h1>
            <p>
              {visibleTasks.length
                ? `${visibleTasks.length} ${visibleTasks.length === 1 ? "задача" : "задач"} в текущем представлении`
                : "Спокойно — здесь пока нет задач"}
            </p>
          </div>
          <div className="header-actions">
            <label className="search-field">
              <Search aria-hidden="true" size={18} />
              <span className="sr-only">Поиск задач</span>
              <input
                ref={searchRef}
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Поиск"
              />
              <kbd>/</kbd>
            </label>
            <button
              className="icon-button"
              type="button"
              aria-label="Открыть настройки"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings aria-hidden="true" />
            </button>
            <button
              className="primary-button desktop-new-task"
              type="button"
              onClick={() => openNewTask()}
            >
              <Plus aria-hidden="true" size={18} />
              Добавить задачу
            </button>
          </div>
        </header>

        <section className="overview-cards" aria-label="Сводка">
          <article>
            <span className="overview-icon violet">
              <List aria-hidden="true" />
            </span>
            <div>
              <span>Всего</span>
              <strong>{statistics.total}</strong>
            </div>
          </article>
          <article>
            <span className="overview-icon blue">
              <CalendarDays aria-hidden="true" />
            </span>
            <div>
              <span>На сегодня</span>
              <strong>{statistics.today}</strong>
            </div>
          </article>
          <article>
            <span className="overview-icon amber">
              <Sparkles aria-hidden="true" />
            </span>
            <div>
              <span>В работе</span>
              <strong>{statistics.active}</strong>
            </div>
          </article>
          <article>
            <span className="overview-icon green">
              <CheckCircle2 aria-hidden="true" />
            </span>
            <div>
              <span>Готово</span>
              <strong>{statistics.done}</strong>
            </div>
          </article>
        </section>

        <section className="quick-add-section">
          <form className="quick-add" onSubmit={createQuickTask}>
            <span className="quick-add-icon">
              <Plus aria-hidden="true" />
            </span>
            <label>
              <span className="sr-only">Быстро добавить задачу</span>
              <input
                value={quickTask}
                onChange={(event) => setQuickTask(event.target.value)}
                placeholder="Добавьте задачу: отчёт /сегодня @Работа #важное /срочно"
                maxLength={320}
              />
            </label>
            <button className="primary-button" type="submit">
              Добавить
            </button>
          </form>
          <div className="quick-chips" aria-label="Быстрые команды">
            {["/сегодня", "/завтра", "/срочно", "#фокус"].map((command) => (
              <button
                type="button"
                key={command}
                onClick={() =>
                  setQuickTask((current) =>
                    `${current}${current ? " " : ""}${command}`,
                  )
                }
              >
                {command}
              </button>
            ))}
            {activeProjects.slice(0, 3).map((project) => (
              <button
                type="button"
                key={project.id}
                onClick={() =>
                  setQuickTask((current) =>
                    `${current}${current ? " " : ""}@${project.name}`,
                  )
                }
              >
                <i style={{ backgroundColor: project.color }} />
                @{project.name}
              </button>
            ))}
          </div>
        </section>

        <div className="view-toolbar">
          <div className="view-tabs" role="tablist" aria-label="Представление">
            {[
              { id: "list" as const, label: "Список", icon: List },
              { id: "board" as const, label: "Доска", icon: LayoutDashboard },
              { id: "calendar" as const, label: "Календарь", icon: CalendarDays },
              { id: "analytics" as const, label: "Аналитика", icon: BarChart3 },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={view === item.id}
                  className={view === item.id ? "active" : ""}
                  onClick={() => setView(item.id)}
                >
                  <Icon aria-hidden="true" size={17} />
                  {item.label}
                </button>
              );
            })}
          </div>
          <div className="filter-actions">
            <label>
              <span className="sr-only">Фильтр по проекту</span>
              <select
                value={projectFilter}
                onChange={(event) => setProjectFilter(event.target.value)}
              >
                <option value="all">Все проекты</option>
                {activeProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Фильтр по приоритету</span>
              <select
                value={priorityFilter}
                onChange={(event) =>
                  setPriorityFilter(event.target.value as Priority | "all")
                }
              >
                <option value="all">Любой приоритет</option>
                <option value="critical">Критичный</option>
                <option value="high">Высокий</option>
                <option value="medium">Средний</option>
                <option value="low">Низкий</option>
              </select>
            </label>
            {view === "list" ? (
              <button
                className={`secondary-button ${bulkMode ? "active" : ""}`}
                type="button"
                aria-pressed={bulkMode}
                onClick={() => {
                  setBulkMode((current) => !current);
                  setSelectedIds(new Set());
                }}
              >
                <CheckCircle2 aria-hidden="true" size={17} />
                Выбрать
              </button>
            ) : null}
          </div>
        </div>

        {bulkMode && selectedIds.size ? (
          <div className="bulk-toolbar" role="region" aria-label="Массовые действия">
            <strong>Выбрано: {selectedIds.size}</strong>
            <button type="button" onClick={() => bulkSetStatus("in-progress")}>
              В работу
            </button>
            <button type="button" onClick={() => bulkSetStatus("done")}>
              Выполнить
            </button>
            <button className="danger-text" type="button" onClick={bulkDelete}>
              <Trash2 aria-hidden="true" size={16} />
              В архив
            </button>
          </div>
        ) : null}

        <div className={`view-content view-${view}`}>
          {view === "list" ? (
            visibleTasks.length ? (
              <section className="task-list" aria-label="Список задач">
                {visibleTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    project={
                      activeProjects.find(
                        (project) => project.id === task.projectId,
                      ) ?? null
                    }
                    density={snapshot.preferences.density}
                    selected={selectedIds.has(task.id)}
                    onSelect={
                      bulkMode
                        ? (selected) => toggleSelected(task.id, selected)
                        : undefined
                    }
                    onComplete={(current, completed) =>
                      changeStatus(current, completed ? "done" : "in-progress")
                    }
                    onStatusChange={changeStatus}
                    onToggleSubtask={toggleSubtask}
                    onEdit={(current) => {
                      setEditorTask(current);
                      setEditorIsNew(false);
                    }}
                    onDelete={deleteTask}
                  />
                ))}
              </section>
            ) : (
              <section className="empty-state">
                <span>
                  <CheckCircle2 aria-hidden="true" />
                </span>
                <h2>Здесь всё разобрано</h2>
                <p>
                  Измените фильтры или добавьте новую задачу — она появится
                  мгновенно.
                </p>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => openNewTask()}
                >
                  <Plus aria-hidden="true" size={18} />
                  Добавить задачу
                </button>
              </section>
            )
          ) : null}
          {view === "board" ? (
            <BoardView
              tasks={visibleTasks}
              projects={activeProjects}
              onStatusChange={changeStatus}
              onEdit={(task) => {
                setEditorTask(task);
                setEditorIsNew(false);
              }}
            />
          ) : null}
          {view === "calendar" ? (
            <CalendarView
              tasks={allTasks.filter(
                (task) =>
                  projectFilter === "all" || task.projectId === projectFilter,
              )}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              onSelectDay={setSelectedDay}
            />
          ) : null}
          {view === "analytics" && hasPremiumAccess ? (
            <AnalyticsView tasks={visibleTasks} />
          ) : null}
          {view === "analytics" && !hasPremiumAccess ? (
            <section className="premium-gate">
              <span>
                <Sparkles aria-hidden="true" />
              </span>
              <h2>Расширенная аналитика — в Premium</h2>
              <p>
                Оцените процент выполнения, текущую нагрузку, просрочки и
                распределение задач по приоритету.
              </p>
              <button
                className="primary-button"
                type="button"
                onClick={() => void startCheckout()}
              >
                Открыть Premium
              </button>
            </section>
          ) : null}
        </div>
      </section>

      <nav className="mobile-bottom-nav" aria-label="Основная навигация">
        {[
          { id: "today" as const, label: "Сегодня", icon: CalendarDays },
          { id: "all" as const, label: "Задачи", icon: List },
          { id: "calendar" as const, label: "Календарь", icon: CalendarDays },
          { id: "projects" as const, label: "Проекты", icon: Folder },
        ].map((item) => {
          const Icon = item.icon;
          const active =
            (item.id === "calendar" && view === "calendar") ||
            (item.id === "today" && smartList === "today" && view === "list") ||
            (item.id === "all" && smartList === "all" && view === "list");
          return (
            <button
              type="button"
              key={item.id}
              className={active ? "active" : ""}
              onClick={() => {
                if (item.id === "calendar") setView("calendar");
                else if (item.id === "projects") setMobileMenuOpen(true);
                else {
                  setSmartList(item.id);
                  setView("list");
                }
              }}
            >
              <Icon aria-hidden="true" size={21} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <TaskEditor
        key={editorTask?.id ?? "task-editor-closed"}
        task={editorTask}
        isNew={editorIsNew}
        projects={activeProjects}
        onClose={() => setEditorTask(null)}
        onSave={saveTask}
        onDelete={deleteTask}
      />

      <Dialog
        open={projectDialogOpen}
        title={editingProject ? "Редактирование проекта" : "Новый проект"}
        description={
          editingProject
            ? "Измените название или цвет — задачи останутся на месте."
            : "Объединяйте связанные задачи и быстро переключайтесь между контекстами."
        }
        onClose={closeProjectDialog}
        size="small"
      >
        <form className="project-form" onSubmit={saveProject}>
          <label className="field">
            <span>Название проекта</span>
            <input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              maxLength={80}
              placeholder="Например, Запуск продукта"
            />
          </label>
          <fieldset className="color-picker">
            <legend>Цвет</legend>
            {PROJECT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={projectColor === color ? "active" : ""}
                style={{ backgroundColor: color }}
                aria-label={`Выбрать цвет ${color}`}
                aria-pressed={projectColor === color}
                onClick={() => setProjectColor(color)}
              >
                {projectColor === color ? (
                  <Check aria-hidden="true" size={16} />
                ) : null}
              </button>
            ))}
          </fieldset>
          <div className="form-actions">
            <span />
            <div>
              <button
                className="ghost-button"
                type="button"
                onClick={closeProjectDialog}
              >
                Отмена
              </button>
              <button className="primary-button" type="submit">
                {editingProject ? (
                  <Check aria-hidden="true" size={17} />
                ) : (
                  <FolderPlus aria-hidden="true" size={17} />
                )}
                {editingProject ? "Сохранить" : "Создать проект"}
              </button>
            </div>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(selectedDay)}
        title={selectedDay ? formatLongDate(selectedDay) : "День"}
        description={`Задач на день: ${dayTasks.length}`}
        onClose={() => setSelectedDay(null)}
        size="medium"
      >
        <div className="day-agenda">
          <button
            className="primary-button"
            type="button"
            onClick={() => openNewTask(selectedDay)}
          >
            <Plus aria-hidden="true" size={17} />
            Добавить на этот день
          </button>
          {dayTasks.length ? (
            dayTasks.map((task) => (
              <button
                key={task.id}
                className="agenda-task"
                type="button"
                onClick={() => {
                  setSelectedDay(null);
                  setEditorTask(task);
                  setEditorIsNew(false);
                }}
              >
                <i className={`priority-${task.priority}`} aria-hidden="true" />
                <span>
                  <strong>{task.title}</strong>
                  <small>
                    {
                      activeProjects.find(
                        (project) => project.id === task.projectId,
                      )?.name
                    }
                  </small>
                </span>
                {task.status === "done" ? (
                  <CheckCircle2 aria-label="Выполнено" size={18} />
                ) : (
                  <ChevronRight aria-hidden="true" size={18} />
                )}
              </button>
            ))
          ) : (
            <div className="agenda-empty">
              <CalendarDays aria-hidden="true" />
              <p>На эту дату задач пока нет.</p>
            </div>
          )}
        </div>
      </Dialog>

      <Dialog
        open={settingsOpen}
        title="Настройки"
        description="Оформление, данные, проекты и синхронизация."
        onClose={() => setSettingsOpen(false)}
        size="large"
      >
        <div className="settings-layout">
          <section className="settings-section">
            <header>
              <Sparkles aria-hidden="true" />
              <div>
                <h3>Оформление</h3>
                <p>Настройки хранятся вместе с вашим профилем.</p>
              </div>
            </header>
            <div className="setting-row">
              <div>
                <strong>Тема</strong>
                <span>Системная, светлая или тёмная</span>
              </div>
              <select
                value={snapshot.preferences.theme}
                onChange={(event) =>
                  setPreference(
                    "theme",
                    event.target.value as PlannerSnapshot["preferences"]["theme"],
                  )
                }
              >
                <option value="system">Системная</option>
                <option value="light">Светлая</option>
                <option value="dark">Тёмная</option>
                <option value="sunset" disabled={!hasPremiumAccess}>
                  Закат · Premium
                </option>
                <option value="forest" disabled={!hasPremiumAccess}>
                  Лес · Premium
                </option>
              </select>
            </div>
            <div className="setting-row">
              <div>
                <strong>Плотность</strong>
                <span>Размер карточек списка</span>
              </div>
              <select
                value={snapshot.preferences.density}
                onChange={(event) =>
                  setPreference(
                    "density",
                    event.target
                      .value as PlannerSnapshot["preferences"]["density"],
                  )
                }
              >
                <option value="comfortable">Комфортная</option>
                <option value="compact">Компактная</option>
              </select>
            </div>
          </section>

          <section className="settings-section">
            <header>
              <Folder aria-hidden="true" />
              <div>
                <h3>Проекты</h3>
                <p>Активные проекты и распределение задач.</p>
              </div>
            </header>
            <div className="settings-project-list">
              {activeProjects.map((project) => (
                <div key={project.id}>
                  <i style={{ backgroundColor: project.color }} />
                  <span>
                    <strong>{project.name}</strong>
                    <small>
                      {
                        allTasks.filter(
                          (task) => task.projectId === project.id,
                        ).length
                      }{" "}
                      задач
                    </small>
                  </span>
                  <div className="project-row-actions">
                    <button
                      className="icon-button compact"
                      type="button"
                      aria-label={`Редактировать проект ${project.name}`}
                      onClick={() => {
                        setSettingsOpen(false);
                        openProjectDialog(project);
                      }}
                    >
                      <Pencil aria-hidden="true" size={15} />
                    </button>
                    <button
                      className="icon-button compact danger-icon"
                      type="button"
                      aria-label={`Архивировать проект ${project.name}`}
                      disabled={activeProjects.length <= 1}
                      onClick={() => deleteProject(project)}
                    >
                      <Trash2 aria-hidden="true" size={16} />
                    </button>
                  </div>
                </div>
              ))}
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  openProjectDialog();
                }}
              >
                <FolderPlus aria-hidden="true" size={17} />
                Новый проект
              </button>
            </div>
          </section>

          <section className="settings-section">
            <header>
              <ShieldCheck aria-hidden="true" />
              <div>
                <h3>Профиль и Premium</h3>
                <p>
                  {STATIC_BUILD
                    ? "GitHub Pages: задачи хранятся только на этом телефоне. Используйте резервные копии."
                    : sessionUser
                    ? `Выполнен защищённый вход: ${sessionUser.displayName}`
                    : "Локальный режим. Откройте приложение в Telegram для облачной синхронизации."}
                </p>
              </div>
            </header>
            <div className="plan-card">
              <span>
                <Sparkles aria-hidden="true" />
              </span>
              <div>
                <strong>
                  {STATIC_BUILD
                    ? "Автономная версия GitHub Pages"
                    : `Тариф: ${sessionUser?.plan ?? "локальный бесплатный"}`}
                </strong>
                <p>
                  {STATIC_BUILD
                    ? "Все функции планирования доступны без входа. Облачная синхронизация, Telegram-напоминания и оплата требуют Worker-версии."
                    : "Быстрый ввод, проекты, доска и календарь доступны бесплатно. Premium открывает расширенную аналитику и дополнительные темы оформления."}
                </p>
              </div>
              {!STATIC_BUILD && sessionUser?.plan === "free" ? (
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => void startCheckout()}
                >
                  Улучшить тариф
                </button>
              ) : null}
            </div>
          </section>

          <section className="settings-section">
            <header>
              <ArchiveRestore aria-hidden="true" />
              <div>
                <h3>Резервная копия</h3>
                <p>Экспорт проходит локально; данные не уходят третьим лицам.</p>
              </div>
            </header>
            <div className="backup-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => downloadJson(snapshot)}
              >
                <Download aria-hidden="true" size={17} />
                Скачать JSON
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => importRef.current?.click()}
              >
                <Upload aria-hidden="true" size={17} />
                Импортировать
              </button>
              <input
                ref={importRef}
                className="sr-only"
                type="file"
                accept="application/json,.json"
                onChange={handleImportFile}
              />
            </div>
          </section>

          <section className="settings-section danger-zone">
            <header>
              <AlertTriangle aria-hidden="true" />
              <div>
                <h3>Сброс всех данных</h3>
                <p>
                  При активной синхронизации изменения применятся и в облаке.
                  Перед сбросом экспортируйте копию и введите «УДАЛИТЬ».
                </p>
              </div>
            </header>
            <div className="reset-row">
              <input
                value={resetPhrase}
                onChange={(event) => setResetPhrase(event.target.value)}
                placeholder="УДАЛИТЬ"
              />
              <button
                className="danger-button"
                type="button"
                disabled={resetPhrase !== "УДАЛИТЬ"}
                onClick={() => void resetAllData()}
              >
                <Trash2 aria-hidden="true" size={17} />
                Сбросить
              </button>
            </div>
          </section>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(importCandidate)}
        title="Проверка импорта"
        description="Файл прошёл проверку структуры. Подтвердите замену текущих данных."
        onClose={() => setImportCandidate(null)}
        size="small"
      >
        {importCandidate ? (
          <div className="import-preview">
            <div>
              <span>Проекты</span>
              <strong>{importCandidate.projects.length}</strong>
            </div>
            <div>
              <span>Задачи</span>
              <strong>{importCandidate.tasks.length}</strong>
            </div>
            <p>
              Перед заменой приложение автоматически скачает резервную копию
              текущего состояния.
            </p>
            <footer className="form-actions">
              <span />
              <div>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => setImportCandidate(null)}
                >
                  Отмена
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={applyImport}
                >
                  Импортировать
                </button>
              </div>
            </footer>
          </div>
        ) : null}
      </Dialog>

      {toast ? (
        <div
          className={`toast toast-${toast.tone ?? "success"}`}
          role="status"
          aria-live="polite"
        >
          <span>
            {toast.tone === "error" ? (
              <AlertTriangle aria-hidden="true" />
            ) : (
              <CheckCircle2 aria-hidden="true" />
            )}
          </span>
          <div>
            <strong>{toast.message}</strong>
            {toast.detail ? <small>{toast.detail}</small> : null}
          </div>
          {toast.actionLabel && toast.onAction ? (
            <button
              type="button"
              onClick={() => {
                toast.onAction?.();
                setToast(null);
              }}
            >
              {toast.actionLabel}
            </button>
          ) : null}
          <button
            className="icon-button compact"
            type="button"
            aria-label="Закрыть уведомление"
            onClick={() => setToast(null)}
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>
      ) : null}
    </main>
  );
}
