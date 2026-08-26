"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@selecta/ui/lib/utils";

/** Readable hold, on the same scale as `--motion-slow` (500ms × 4). */
const TOAST_DURATION_MS = 2000;

type ToastContextValue = {
  toast: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const toast = useCallback((next: string) => {
    setMessage(next);
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setMessage(null);
      timerRef.current = null;
    }, TOAST_DURATION_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message ? (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "border-border bg-popover text-popover-foreground pointer-events-none fixed bottom-6 left-1/2 z-50 max-w-md -translate-x-1/2 rounded-lg border px-3.5 py-2 text-center text-sm duration-fast",
          )}
        >
          {message}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }
  return context;
}
