import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    initialFocusRef?: React.RefObject<HTMLElement | null>;
    size?: "sm" | "md" | "lg";
};

const sizes = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
};

export default function Modal({
    open,
    onClose,
    title,
    children,
    footer,
    initialFocusRef,
    size = "md",
}: ModalProps) {
    const backdropRef = useRef<HTMLDivElement>(null);

    // ESC за затваряне
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    // фокус при отваряне
    useEffect(() => {
        if (open) initialFocusRef?.current?.focus();
    }, [open, initialFocusRef]);

    if (!open) return null;

    return createPortal(
        <div
            ref={backdropRef}
            onMouseDown={(e) => {
                // клик по бекдропа затваря (но не и по съдържанието)
                if (e.target === backdropRef.current) onClose();
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            aria-modal="true"
            role="dialog"
        >
            <div
                className={`w-full ${sizes[size]} rounded bg-white shadow-lg focus:outline-none`}
            >
                {title && (
                    <div className="border-b px-4 py-3 text-base font-semibold">
                        {title}
                    </div>
                )}
                <div className="px-4 py-4">{children}</div>
                {footer && <div className="border-t px-4 py-3">{footer}</div>}
            </div>
        </div>,
        document.body
    );
}
