"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { TrashActionResult } from "@/lib/trash-result";
import "@/app/styling/TrashUndoProvider.css";

type UndoPayload = {
  message: string;
  onUndo: () => Promise<TrashActionResult | void>;
};

const TrashUndoContext = createContext<{
  showTrashUndo: (payload: UndoPayload) => void;
} | null>(null);

export function TrashUndoProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<UndoPayload | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const undoOnceRef = useRef(false);

  const clearTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const showTrashUndo = useCallback(({ message, onUndo }: UndoPayload) => {
    clearTimer();
    undoOnceRef.current = false;
    setFeedback(null);
    setToast({ message, onUndo });
    timeoutRef.current = window.setTimeout(() => {
      setToast(null);
      setFeedback(null);
    }, 6000);
  }, []);

  useEffect(() => () => clearTimer(), []);

  const handleUndo = async () => {
    if (!toast || undoOnceRef.current) return;
    undoOnceRef.current = true;
    clearTimer();
    const payload = toast;
    setToast(null);
    try {
      const res = (await payload.onUndo()) as TrashActionResult | void;
      if (res && typeof res === "object" && "ok" in res) {
        if (res.ok) {
          setFeedback("Restored.");
        } else if (res.reason === "not_restorable") {
          setFeedback("Couldn't restore — item was permanently deleted.");
        } else if (res.reason === "forbidden") {
          setFeedback("Couldn't restore this item.");
        } else {
          setFeedback(null);
        }
        if (res.ok || res.reason === "not_restorable" || res.reason === "forbidden") {
          timeoutRef.current = window.setTimeout(() => setFeedback(null), 4000);
        }
      }
    } catch {
      setFeedback("Couldn't restore this item.");
      timeoutRef.current = window.setTimeout(() => setFeedback(null), 4000);
    }
  };

  return (
    <TrashUndoContext.Provider value={{ showTrashUndo }}>
      {children}
      {(toast || feedback) && (
        <div className="trash-undo-bar" role="status">
          <span className="trash-undo-bar-message">{feedback ?? toast?.message}</span>
          {toast && !feedback && (
            <button type="button" className="trash-undo-bar-action" onClick={() => void handleUndo()}>
              Undo
            </button>
          )}
        </div>
      )}
    </TrashUndoContext.Provider>
  );
}

export function useTrashUndoOptional() {
  return useContext(TrashUndoContext);
}
