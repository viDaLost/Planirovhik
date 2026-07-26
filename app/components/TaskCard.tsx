"use client";

import {
  CalendarDays,
  Clock3,
  Pencil,
  Repeat2,
  Trash2,
} from "lucide-react";
import {
  STATUS_OPTIONS,
  Project,
  Status,
  Task,
} from "@/lib/planner-types";
import {
  formatTaskDate,
  isTaskOverdue,
} from "@/lib/planner-utils";

type TaskCardProps = {
  task: Task;
  project: Project | null;
  density: "comfortable" | "compact";
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  onComplete: (task: Task, completed: boolean) => void;
  onStatusChange: (task: Task, status: Status) => void;
  onToggleSubtask: (task: Task, subtaskId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
};

export function TaskCard({
  task,
  project,
  density,
  selected,
  onSelect,
  onComplete,
  onStatusChange,
  onToggleSubtask,
  onEdit,
  onDelete,
}: TaskCardProps) {
  const overdue = isTaskOverdue(task);
  const completedSubtasks = task.subtasks.filter(
    (subtask) => subtask.completed,
  ).length;

  return (
    <article
      className={`task-card priority-${task.priority} density-${density} ${
        task.status === "done" ? "task-completed" : ""
      }`}
      data-task-id={task.id}
    >
      {onSelect ? (
        <label className="bulk-check">
          <span className="sr-only">Выбрать задачу {task.title}</span>
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onSelect(event.target.checked)}
          />
        </label>
      ) : null}

      <label className="complete-check">
        <span className="sr-only">
          {task.status === "done"
            ? `Вернуть задачу ${task.title} в работу`
            : `Выполнить задачу ${task.title}`}
        </span>
        <input
          type="checkbox"
          checked={task.status === "done"}
          onChange={(event) => onComplete(task, event.target.checked)}
        />
        <span aria-hidden="true" />
      </label>

      <div className="task-card-body">
        <button
          className="task-title-button"
          type="button"
          onClick={() => onEdit(task)}
        >
          {task.title}
        </button>
        {task.description && density === "comfortable" ? (
          <p className="task-description">{task.description}</p>
        ) : null}

        <div className="task-meta">
          {project ? (
            <span className="project-chip">
              <i style={{ backgroundColor: project.color }} aria-hidden="true" />
              {project.name}
            </span>
          ) : null}
          <span className={`priority-chip priority-${task.priority}`}>
            {{
              low: "Низкий",
              medium: "Средний",
              high: "Высокий",
              critical: "Критичный",
            }[task.priority]}
          </span>
          <span className={overdue ? "overdue-date" : ""}>
            <CalendarDays aria-hidden="true" size={14} />
            {formatTaskDate(task.dueDate)}
          </span>
          {task.estimateMinutes ? (
            <span>
              <Clock3 aria-hidden="true" size={14} />
              {task.estimateMinutes >= 60
                ? `${task.estimateMinutes / 60} ч`
                : `${task.estimateMinutes} мин`}
            </span>
          ) : null}
          {task.recurrence !== "none" ? (
            <span title="Повторяющаяся задача">
              <Repeat2 aria-hidden="true" size={14} />
              Повтор
            </span>
          ) : null}
        </div>

        {task.tags.length ? (
          <div className="tag-row" aria-label="Теги">
            {task.tags.slice(0, 5).map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </div>
        ) : null}

        {task.subtasks.length && density === "comfortable" ? (
          <div className="subtask-preview">
            <div className="subtask-progress-head">
              <span>Подзадачи</span>
              <span>
                {completedSubtasks}/{task.subtasks.length}
              </span>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={task.subtasks.length}
              aria-valuenow={completedSubtasks}
              aria-label={`Выполнено подзадач: ${completedSubtasks} из ${task.subtasks.length}`}
            >
              <span
                style={{
                  width: `${(completedSubtasks / task.subtasks.length) * 100}%`,
                }}
              />
            </div>
            {task.subtasks.slice(0, 3).map((subtask) => (
              <label key={subtask.id} className="subtask-preview-row">
                <input
                  type="checkbox"
                  checked={subtask.completed}
                  onChange={() => onToggleSubtask(task, subtask.id)}
                />
                <span>{subtask.title}</span>
              </label>
            ))}
          </div>
        ) : null}
      </div>

      <div className="task-card-actions">
        <label>
          <span className="sr-only">Статус задачи {task.title}</span>
          <select
            value={task.status}
            onChange={(event) =>
              onStatusChange(task, event.target.value as Status)
            }
            aria-label={`Статус задачи ${task.title}`}
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status.id} value={status.id}>
                {status.short}
              </option>
            ))}
          </select>
        </label>
        <button
          className="icon-button compact"
          type="button"
          aria-label={`Редактировать задачу ${task.title}`}
          onClick={() => onEdit(task)}
        >
          <Pencil aria-hidden="true" size={16} />
        </button>
        <button
          className="icon-button compact danger-icon"
          type="button"
          aria-label={`Удалить задачу ${task.title}`}
          onClick={() => onDelete(task)}
        >
          <Trash2 aria-hidden="true" size={16} />
        </button>
      </div>
    </article>
  );
}
