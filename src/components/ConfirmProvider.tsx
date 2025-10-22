// src/components/ConfirmProvider.tsx
import {
  createContext, useContext, useState, useRef, useCallback,
  type ReactNode
} from "react";
import Modal from "./Modal";

type ConfirmOptions = {
  title?: string;
  message?: ReactNode;          // <— ПОЗВОЛЯВА JSX
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

type ConfirmFn = (opts?: ConfirmOptions) => Promise<boolean>;
const ConfirmCtx = createContext<ConfirmFn | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({});
  // ✅ resolver трябва да започне с null
  const resolver = useRef<((v: boolean) => void) | null>(null);
  // ✅ initialFocusRef очаква реф към HTMLButtonElement
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const confirm: ConfirmFn = useCallback((options?: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setOpts(options ?? {});
      resolver.current = resolve;
      setOpen(true);
    });
  }, []);

  const handle = (result: boolean) => {
    setOpen(false);
    resolver.current?.(result);
    resolver.current = null;
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}

      <Modal
        open={open}
        onClose={() => handle(false)}
        // @headlessui | radix: ако библиотеката поддържа initialFocus
        initialFocusRef={confirmBtnRef}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button className="rounded border px-3 py-2" onClick={() => handle(false)}>
              {opts.cancelText ?? "Откажи"}
            </button>
            <button
              ref={confirmBtnRef}
              className={
                "rounded px-3 py-2 text-white " +
                (opts.danger ? "bg-red-600 hover:bg-red-700" : "bg-black hover:bg-gray-800")
              }
              onClick={() => handle(true)}
            >
              {opts.confirmText ?? "Да"}
            </button>
          </div>
        }
      >
        <div className="text-sm text-gray-700">
          {opts.title && <h3 className="text-base font-medium mb-1">{opts.title}</h3>}
          {opts.message && <div className="leading-6">{opts.message}</div>}
        </div>
      </Modal>
    </ConfirmCtx.Provider>
  );
}
