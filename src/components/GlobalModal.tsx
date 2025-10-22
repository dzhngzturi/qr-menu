import { createContext, useContext, useState, type ReactNode } from "react";
import Modal from "./Modal";

type Options = {
  title?: string;
  size?: "sm" | "md" | "lg";
  footer?: ReactNode;
};

type Ctx = {
  show: (content: ReactNode, opts?: Options) => void;
  hide: () => void;
};

const Ctx = createContext<Ctx>({} as any);
export const useGlobalModal = () => useContext(Ctx);

export function GlobalModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<ReactNode>(null);
  const [opts, setOpts] = useState<Options>({});

  const show: Ctx["show"] = (c, o) => {
    setContent(c);
    setOpts(o ?? {});
    setOpen(true);
  };
  const hide = () => setOpen(false);

  return (
    <Ctx.Provider value={{ show, hide }}>
      {children}
      <Modal open={open} onClose={hide} title={opts.title} size={opts.size ?? "md"} footer={opts.footer}>
        {content}
      </Modal>
    </Ctx.Provider>
  );
}
