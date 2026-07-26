"use client";

import {
  ChangeEvent,
  FormEvent,
  useState,
} from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog } from "@/app/components/Dialog";
import {
  PRIORITY_OPTIONS,
  Project,
  RECURRENCE_OPTIONS,
  STATUS_OPTIONS,
  Task,
  TaskSchema,
} from "@/lib/planner-types";

type TaskEditorProps = {
  task: Task | null;
  isNew: boolean;
  projects: Project[];
  onClose: () => void;
  onSave: (task: Task) => void;
  onDelete?: (task: Task) => void;
};

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function TaskEditor({
  task,
  isNew,
  projects,
  onClose,
  onSave,
  onDelete,
}: TaskEditorProps) {
  const [draft, setDraft] = useState<Task | null>(task);
  const [tags, setTags] = useState(task?.tags.join(", ") ?? "");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [error, setError] = useState("");

  if (!draft) return null;

  function update<K extends keyof Task>(key: K, value: Task[K]) {
    setDraft((current) =>
      current ? { ...current, [key]: value } : current,
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const now = new Date().toISOString();
    const candidate = {
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      tags: tags
        .split(",")
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean),
      updatedAt: now,
    };
    const parsed = TaskSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ===
          "String must contain at least 1 character(s)"
          ? "Введите название задачи."
          : "Проверьте заполненные поля.",
      );
      return;
    }
    onSave(parsed.data);
  }

  function handleReminder(event: ChangeEvent<HTMLInputElement>) {
    update(
      "reminderAt",
      event.target.value ? new Date(event.target.value).toISOString() : null,
    );
  }

  function addSubtask() {
    if (!subtaskTitle.trim()) return;
    update("subtasks", [
      ...draft!.subtasks,
      {
        id: crypto.randomUUID(),
        title: subtaskTitle.trim().slice(0, 160),
        completed: false,
      },
    ]);
    setSubtaskTitle("");
  }

  return (
    <Dialog
      open={Boolean(task)}
      title={isNew ? "Новая задача" : "Редактирование задачи"}
      description="Добавьте детали, чтобы задачу было проще выполнить вовремя."
      onClose={onClose}
      size="large"
    >
      <form className="task-form" onSubmit={handleSubmit}>
        <label className="field field-wide">
          <span>Название</span>
          <input
            value={draft.title}
            onChange={(event) => update("title", event.target.value)}
            placeholder="Что нужно сделать?"
            maxLength={240}
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span>Проект</span>
          <select
            value={draft.projectId ?? ""}
            onChange={(event) =>
              update("projectId", event.target.value || null)
            }
          >
            <option value="">Без проекта</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Статус</span>
          <select
            value={draft.status}
            onChange={(event) =>
              update("status", event.target.value as Task["status"])
            }
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status.id} value={status.id}>
                {status.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Приоритет</span>
          <select
            value={draft.priority}
            onChange={(event) =>
              update("priority", event.target.value as Task["priority"])
            }
          >
            {PRIORITY_OPTIONS.map((priority) => (
              <option key={priority.id} value={priority.id}>
                {priority.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Срок</span>
          <input
            type="date"
            value={draft.dueDate ?? ""}
            onChange={(event) => update("dueDate", event.target.value || null)}
          />
        </label>

        <label className="field">
          <span>Повторение</span>
          <select
            value={draft.recurrence}
            onChange={(event) =>
              update("recurrence", event.target.value as Task["recurrence"])
            }
          >
            {RECURRENCE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Оценка времени</span>
          <select
            value={draft.estimateMinutes ?? ""}
            onChange={(event) =>
              update(
                "estimateMinutes",
                event.target.value ? Number(event.target.value) : null,
              )
            }
          >
            <option value="">Не указана</option>
            <option value="15">15 минут</option>
            <option value="30">30 минут</option>
            <option value="60">1 час</option>
            <option value="120">2 часа</option>
            <option value="240">4 часа</option>
          </select>
        </label>

        <label className="field field-wide">
          <span>Напоминание</span>
          <input
            type="datetime-local"
            value={toLocalDateTime(draft.reminderAt)}
            onChange={handleReminder}
          />
          <small>
            Серверное напоминание отправляется через Telegram после входа.
          </small>
        </label>

        <label className="field field-wide">
          <span>Описание</span>
          <textarea
            rows={4}
            value={draft.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="Контекст, ссылки или ожидаемый результат"
            maxLength={4_000}
          />
        </label>

        <label className="field field-wide">
          <span>Теги через запятую</span>
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="фокус, работа, важное"
            maxLength={400}
          />
        </label>

        <fieldset className="subtasks-field field-wide">
          <legend>Подзадачи</legend>
          {draft.subtasks.length ? (
            <div className="subtask-edit-list">
              {draft.subtasks.map((subtask) => (
                <div key={subtask.id} className="subtask-edit-row">
                  <input
                    type="checkbox"
                    checked={subtask.completed}
                    aria-label={`Выполнено: ${subtask.title}`}
                    onChange={(event) =>
                      update(
                        "subtasks",
                        draft.subtasks.map((candidate) =>
                          candidate.id === subtask.id
                            ? { ...candidate, completed: event.target.checked }
                            : candidate,
                        ),
                      )
                    }
                  />
                  <span>{subtask.title}</span>
                  <button
                    type="button"
                    className="icon-button compact"
                    aria-label={`Удалить подзадачу ${subtask.title}`}
                    onClick={() =>
                      update(
                        "subtasks",
                        draft.subtasks.filter(
                          (candidate) => candidate.id !== subtask.id,
                        ),
                      )
                    }
                  >
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="subtask-add">
            <input
              value={subtaskTitle}
              onChange={(event) => setSubtaskTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addSubtask();
                }
              }}
              placeholder="Добавить шаг"
              maxLength={160}
            />
            <button
              className="secondary-button"
              type="button"
              onClick={addSubtask}
            >
              <Plus aria-hidden="true" size={17} />
              Добавить
            </button>
          </div>
        </fieldset>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <footer className="form-actions field-wide">
          {!isNew && onDelete ? (
            <button
              className="danger-button"
              type="button"
              onClick={() => onDelete(draft)}
            >
              <Trash2 aria-hidden="true" size={17} />
              Удалить
            </button>
          ) : (
            <span />
          )}
          <div>
            <button className="ghost-button" type="button" onClick={onClose}>
              Отмена
            </button>
            <button className="primary-button" type="submit">
              {isNew ? "Создать задачу" : "Сохранить"}
            </button>
          </div>
        </footer>
      </form>
    </Dialog>
  );
}
