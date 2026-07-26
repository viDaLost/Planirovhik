"use client";

import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { localDateKey, Task } from "@/lib/planner-types";
import { createMonthCells } from "@/lib/planner-utils";

type CalendarViewProps = {
  tasks: Task[];
  month: Date;
  onMonthChange: (month: Date) => void;
  onSelectDay: (dateKey: string) => void;
};

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function CalendarView({
  tasks,
  month,
  onMonthChange,
  onSelectDay,
}: CalendarViewProps) {
  const tasksByDate = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.dueDate || task.deletedAt) continue;
    const bucket = tasksByDate.get(task.dueDate) ?? [];
    bucket.push(task);
    tasksByDate.set(task.dueDate, bucket);
  }

  function shiftMonth(direction: -1 | 1) {
    onMonthChange(new Date(month.getFullYear(), month.getMonth() + direction, 1));
  }

  return (
    <section className="calendar-shell" aria-label="Календарь задач">
      <header className="calendar-header">
        <button
          className="icon-button"
          type="button"
          aria-label="Предыдущий месяц"
          onClick={() => shiftMonth(-1)}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <h2>
          {new Intl.DateTimeFormat("ru-RU", {
            month: "long",
            year: "numeric",
          }).format(month)}
        </h2>
        <button
          className="icon-button"
          type="button"
          aria-label="Следующий месяц"
          onClick={() => shiftMonth(1)}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </header>
      <div className="calendar-weekdays" aria-hidden="true">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {createMonthCells(month).map((cell, index) => {
          if (!cell) {
            return <span className="calendar-spacer" key={`spacer-${index}`} />;
          }
          const dayTasks = tasksByDate.get(cell.dateKey) ?? [];
          const done = dayTasks.filter((task) => task.status === "done").length;
          const isToday = cell.dateKey === localDateKey();
          return (
            <button
              type="button"
              key={cell.dateKey}
              className={`calendar-cell ${isToday ? "calendar-today" : ""} ${
                dayTasks.length ? "calendar-has-tasks" : ""
              }`}
              onClick={() => onSelectDay(cell.dateKey)}
              aria-label={`${cell.day}, задач: ${dayTasks.length}, выполнено: ${done}`}
            >
              <span className="calendar-day">{cell.day}</span>
              {dayTasks.length ? (
                <>
                  <span className="calendar-load">
                    {done}/{dayTasks.length}
                  </span>
                  <span className="calendar-task-preview">
                    {dayTasks[0].title}
                  </span>
                  <span className="calendar-dots" aria-hidden="true">
                    {dayTasks.slice(0, 3).map((task) => (
                      <i
                        key={task.id}
                        className={`priority-${task.priority}`}
                      />
                    ))}
                  </span>
                </>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
