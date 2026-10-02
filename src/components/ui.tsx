"use client";

import clsx from "clsx";
import { AlertTriangle, Loader2, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

// ---------- Button ----------
type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg hover:opacity-90",
  secondary: "bg-surface border border-line text-fg hover:bg-surface-2",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
  danger: "bg-danger text-white hover:opacity-90",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...props
}: ComponentProps<"button"> & {
  variant?: Variant;
  size?: "sm" | "md";
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2",
        size === "sm" ? "h-8 px-2.5 text-sm" : "h-10 px-4 text-sm",
        variants[variant],
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

// ---------- Form fields ----------
const fieldBase =
  "w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 aria-invalid:border-danger";

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: (id: string, describedBy?: string) => ReactNode;
}) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children(id, error || hint ? msgId : undefined)}
      {error ? (
        <p id={msgId} className="text-danger text-xs">
          {error}
        </p>
      ) : hint ? (
        <p id={msgId} className="text-muted text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={clsx(fieldBase, "h-10", className)} />
);
export const Select = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={clsx(fieldBase, "h-10 pr-8", className)} />
);
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={clsx(fieldBase, "py-2", className)} />
);

// ---------- States ----------
export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="text-muted flex items-center justify-center gap-2 py-16 text-sm">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="border-line flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center">
      <div className="from-accent/25 to-accent-2/25 text-accent-ink ring-surface mb-4 grid size-14 place-items-center rounded-2xl bg-gradient-to-br ring-8">
        {icon}
      </div>
      <p className="font-display text-lg font-semibold">{title}</p>
      {body && <p className="text-muted mt-1 max-w-sm text-sm">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="border-danger/30 bg-danger/5 flex flex-col items-center justify-center gap-3 rounded-xl border px-6 py-10 text-center"
    >
      <AlertTriangle className="text-danger size-5" aria-hidden />
      <p className="text-sm">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="bg-danger/10 text-danger rounded-lg px-3 py-2 text-sm">
      {message}
    </p>
  );
}

// ---------- Modal ----------
export function Modal({
  title,
  open,
  onClose,
  children,
  wide,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          "border-line bg-surface animate-pop relative max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border p-5 shadow-2xl sm:rounded-2xl",
          wide ? "sm:max-w-xl" : "sm:max-w-md",
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-muted hover:bg-surface-2 rounded-md p-1"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Toasts ----------
type Toast = {
  id: number;
  message: string;
  tone: "success" | "error";
  action?: { label: string; run: () => void };
};
const ToastCtx = createContext<(t: Omit<Toast, "id">) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((all) => [...all, { ...t, id }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(
              "animate-rise pointer-events-auto flex items-center gap-3 rounded-full px-4 py-2.5 text-sm shadow-lg",
              t.tone === "error" ? "bg-danger text-white" : "bg-fg text-bg",
            )}
          >
            {t.message}
            {t.action && (
              <button
                className="font-semibold underline underline-offset-2"
                onClick={() => {
                  t.action!.run();
                  setToasts((all) => all.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
