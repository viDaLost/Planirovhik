"use client";

import { Task } from "@/lib/planner-types";
import { isTaskOverdue } from "@/lib/planner-utils";

type AnalyticsViewProps = {
  tasks: Task[];
};

export function AnalyticsView({ tasks }: AnalyticsViewProps) {
  const active = tasks.filter((task) => !task.deletedAt);
  const completed = active.filter((task) => task.status === "done").length;
  const overdue = active.filter(isTaskOverdue).length;
  const completionRate = active.length
    ? Math.round((completed / active.length) * 100)
    : 0;
  const byPriority = ["critical", "high", "medium", "low"].map((priority) => ({
    priority,
    count: active.filter((task) => task.priority === priority).length,
  }));
  const maxPriority = Math.max(1, ...byPriority.map((item) => item.count));
  const focusMinutes = active
    .filter((task) => task.status !== "done")
    .reduce((sum, task) => sum + (task.estimateMinutes ?? 0), 0);

  return (
    <section className="analytics-view" aria-label="Аналитика задач">
      <div className="analytics-hero">
        <div>
          <span>Общий прогресс</span>
          <strong>{completionRate}%</strong>
          <p>
            Выполнено {completed} из {active.length} задач
          </p>
        </div>
        <div
          className="completion-ring"
          style={{ "--progress": `${completionRate * 3.6}deg` } as React.CSSProperties}
          role="img"
          aria-label={`Прогресс выполнения ${completionRate}%`}
        >
          <span>{completionRate}%</span>
        </div>
      </div>
      <div className="analytics-cards">
        <article>
          <span>Активные</span>
          <strong>{active.length - completed}</strong>
          <p>задач требуют внимания</p>
        </article>
        <article>
          <span>Просроченные</span>
          <strong>{overdue}</strong>
          <p>{overdue ? "лучше разобрать сегодня" : "всё под контролем"}</p>
        </article>
        <article>
          <span>Оценка нагрузки</span>
          <strong>
            {focusMinutes >= 60
              ? `${Math.round((focusMinutes / 60) * 10) / 10} ч`
              : `${focusMinutes} мин`}
          </strong>
          <p>по активным задачам</p>
        </article>
      </div>
      <article className="priority-chart">
        <header>
          <div>
            <span>Распределение</span>
            <h2>Задачи по приоритету</h2>
          </div>
        </header>
        <div className="bar-list">
          {byPriority.map((item) => (
            <div key={item.priority} className={`bar-row priority-${item.priority}`}>
              <span>
                {{
                  critical: "Критичный",
                  high: "Высокий",
                  medium: "Средний",
                  low: "Низкий",
                }[item.priority]}
              </span>
              <div>
                <i style={{ width: `${(item.count / maxPriority) * 100}%` }} />
              </div>
              <strong>{item.count}</strong>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
