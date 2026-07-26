"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Pencil,
} from "lucide-react";
import {
  STATUS_OPTIONS,
  Project,
  Status,
  Task,
} from "@/lib/planner-types";
import { formatTaskDate } from "@/lib/planner-utils";

type BoardViewProps = {
  tasks: Task[];
  projects: Project[];
  onStatusChange: (task: Task, status: Status) => void;
  onEdit: (task: Task) => void;
};

export function BoardView({
  tasks,
  projects,
  onStatusChange,
  onEdit,
}: BoardViewProps) {
  function move(task: Task, direction: -1 | 1) {
    const index = STATUS_OPTIONS.findIndex((status) => status.id === task.status);
    const next = STATUS_OPTIONS[index + direction];
    if (next) onStatusChange(task, next.id);
  }

  return (
    <section className="board" aria-label="Kanban-доска">
      {STATUS_OPTIONS.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column.id);
        return (
          <div
            className={`board-column board-${column.id}`}
            key={column.id}
            onDragOver={(event) => {
              event.preventDefault();
              event.currentTarget.classList.add("drag-over");
            }}
            onDragLeave={(event) =>
              event.currentTarget.classList.remove("drag-over")
            }
            onDrop={(event) => {
              event.preventDefault();
              event.currentTarget.classList.remove("drag-over");
              const taskId = event.dataTransfer.getData("text/plain");
              const task = tasks.find((candidate) => candidate.id === taskId);
              if (task) onStatusChange(task, column.id);
            }}
          >
            <header className="board-column-header">
              <div>
                <span className="status-dot" aria-hidden="true" />
                <h2>{column.label}</h2>
              </div>
              <span aria-label={`${columnTasks.length} задач`}>
                {columnTasks.length}
              </span>
            </header>
            <div className="board-stack">
              {columnTasks.length ? (
                columnTasks.map((task) => {
                  const project =
                    projects.find(
                      (candidate) => candidate.id === task.projectId,
                    ) ?? null;
                  const statusIndex = STATUS_OPTIONS.findIndex(
                    (status) => status.id === task.status,
                  );
                  return (
                    <article
                      className={`kanban-card priority-${task.priority}`}
                      key={task.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", task.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.currentTarget.classList.add("dragging");
                      }}
                      onDragEnd={(event) =>
                        event.currentTarget.classList.remove("dragging")
                      }
                    >
                      <div className="kanban-card-top">
                        <button type="button" onClick={() => onEdit(task)}>
                          {task.title}
                        </button>
                        <button
                          className="icon-button compact"
                          type="button"
                          aria-label={`Редактировать ${task.title}`}
                          onClick={() => onEdit(task)}
                        >
                          <Pencil aria-hidden="true" size={15} />
                        </button>
                      </div>
                      {task.description ? <p>{task.description}</p> : null}
                      <div className="kanban-meta">
                        {project ? (
                          <span>
                            <i
                              style={{ backgroundColor: project.color }}
                              aria-hidden="true"
                            />
                            {project.name}
                          </span>
                        ) : null}
                        <span>
                          <CalendarDays aria-hidden="true" size={13} />
                          {formatTaskDate(task.dueDate)}
                        </span>
                      </div>
                      {task.tags.length ? (
                        <div className="tag-row">
                          {task.tags.slice(0, 3).map((tag) => (
                            <span key={tag}>#{tag}</span>
                          ))}
                        </div>
                      ) : null}
                      <div className="kanban-move-actions">
                        <button
                          type="button"
                          disabled={statusIndex === 0}
                          onClick={() => move(task, -1)}
                          aria-label={`Переместить ${task.title} в предыдущий статус`}
                        >
                          <ArrowLeft aria-hidden="true" size={15} />
                          Назад
                        </button>
                        <button
                          type="button"
                          disabled={statusIndex === STATUS_OPTIONS.length - 1}
                          onClick={() => move(task, 1)}
                          aria-label={`Переместить ${task.title} в следующий статус`}
                        >
                          Далее
                          <ArrowRight aria-hidden="true" size={15} />
                        </button>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="board-empty">
                  Перетащите задачу в эту колонку
                </div>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
