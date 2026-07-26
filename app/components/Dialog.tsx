"use client";

import {
  ReactNode,
  useEffect,
  useId,
  useRef,
} from "react";
import { X } from "lucide-react";

type DialogProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  size?: "small" | "medium" | "large";
};

export function Dialog({
  open,
  title,
  description,
  children,
  onClose,
  size = "medium",
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>(
      "input, select, textarea, button, [href], [tabindex]:not([tabindex='-1'])",
    );
    window.setTimeout(() => focusable?.focus(), 0);

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const elements = [
        ...panel.querySelectorAll<HTMLElement>(
          "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])",
        ),
      ];
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeydown);
      returnFocusRef.current?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="dialog-layer">
      <button
        className="dialog-backdrop"
        type="button"
        aria-label="Закрыть диалог"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={`dialog-panel dialog-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <header className="dialog-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Закрыть"
            onClick={onClose}
          >
            <X aria-hidden="true" size={20} />
          </button>
        </header>
        <div className="dialog-content">{children}</div>
      </div>
    </div>
  );
}
