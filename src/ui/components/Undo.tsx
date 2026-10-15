import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type Show = (message: string, undo: () => Promise<void>) => void;
const UndoCtx = createContext<Show>(() => {});
export const useUndo = () => useContext(UndoCtx);

export function UndoProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string; undo: () => Promise<void> } | null>(null);
  const show = useCallback<Show>((message, undo) => setToast({ id: Date.now(), message, undo }), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <UndoCtx.Provider value={show}>
      {children}
      {toast && (
        <div className="toast" role="status">
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={async () => {
              const u = toast.undo;
              setToast(null);
              await u();
            }}
          >
            실행 취소
          </button>
        </div>
      )}
    </UndoCtx.Provider>
  );
}
