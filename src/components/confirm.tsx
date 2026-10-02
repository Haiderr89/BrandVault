"use client";

import clsx from "clsx";
import { AlertTriangle, Trash2 } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, FormError } from "./ui";

type ConfirmOptions = {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "default";
  icon?: "trash" | "warning";
  /** Runs while the dialog shows a spinner. Throwing keeps it open and shows the error. */
  onConfirm: () => Promise<void>;
};

const ConfirmCtx = createContext<(opts: ConfirmOptions) => void>(() => {});

/** `const confirm = useConfirm(); confirm({ title, message, onConfirm })` */
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  return (
    <ConfirmCtx.Provider value={setOpts}>
      {children}
      {opts && <ConfirmDialog key={opts.title} opts={opts} onClose={() => setOpts(null)} />}
    </ConfirmCtx.Provider>
  );
}

function ConfirmDialog({ opts, onClose }: { opts: ConfirmOptions; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const danger = opts.tone !== "default";
  const Icon = opts.icon === "warning" ? AlertTriangle : Trash2;

  const close = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  useEffect(() => {
    // Default focus on Cancel: the safe choice for destructive actions.
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await opts.onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={close} aria-hidden />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="border-line bg-surface animate-pop relative w-full overflow-hidden rounded-t-2xl border shadow-2xl sm:max-w-sm sm:rounded-2xl"
      >
        <div
          className={clsx(
            "absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent",
            danger ? "from-danger/15" : "from-accent/15",
          )}
          aria-hidden
        />
        <div className="relative flex flex-col items-center px-6 pt-7 pb-5 text-center">
          <span
            className={clsx(
              "ring-surface grid size-14 place-items-center rounded-2xl ring-8",
              danger ? "bg-danger/15 text-danger" : "bg-accent-soft text-accent-ink",
            )}
          >
            <Icon className="size-6" aria-hidden />
          </span>
          <h2 id="confirm-title" className="font-display mt-4 text-lg font-semibold">
            {opts.title}
          </h2>
          <div id="confirm-message" className="text-muted mt-1.5 text-sm leading-relaxed">
            {opts.message}
          </div>
          {error && (
            <div className="mt-4 w-full text-left">
              <FormError message={error} />
            </div>
          )}
        </div>
        <div className="border-line bg-surface-2/50 flex gap-2 border-t px-6 py-4">
          <Button ref={cancelRef} variant="secondary" className="flex-1" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} className="flex-1" loading={busy} onClick={confirm}>
            {opts.confirmLabel ?? "Confirm"}
          </Button>
        </div>
      </div>
    </div>
  );
}
