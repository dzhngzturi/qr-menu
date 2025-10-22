// Пример за fixed footer (портал избягва проблеми с transform/overflow)
import { createPortal } from "react-dom";

export function MenuFooter() {
  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-black/70 text-white text-center py-2">
      Designed with ❤️ by Dzhangiz Turhan
    </div>,
    document.body
  );
}
