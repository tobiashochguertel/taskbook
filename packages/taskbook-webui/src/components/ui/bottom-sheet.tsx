import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isClosing, setIsClosing] = useState(false);

  const close = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setDragOffset(0);
      onClose();
    }, 200);
  }, [onClose]);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, close]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const diff = e.touches[0].clientY - dragStartY.current;
    if (diff > 0) {
      setDragOffset(diff);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (dragOffset > 100) {
      close();
    } else {
      setDragOffset(0);
    }
  }, [dragOffset, close]);

  if (!open && !isClosing) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: "var(--color-backdrop)" }}
      onClick={close}
      onKeyDown={(e) => e.key === "Escape" && close()}
    >
      <div
        ref={sheetRef}
        className="w-full max-w-xl rounded-t-2xl safe-bottom"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderBottom: "none",
          boxShadow: "0 -10px 40px -5px var(--color-dialog-shadow)",
          transform: isClosing
            ? "translateY(100%)"
            : `translateY(${dragOffset}px)`,
          transition:
            dragOffset === 0 || isClosing
              ? "transform 0.2s ease-out"
              : "none",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center py-3">
          <div
            className="w-10 h-1 rounded-full"
            style={{ backgroundColor: "var(--color-border)" }}
          />
        </div>

        {title && (
          <div
            className="px-5 pb-3 border-b"
            style={{ borderColor: "var(--color-border)" }}
          >
            <h3
              className="text-sm font-semibold"
              style={{ color: "var(--color-text)" }}
            >
              {title}
            </h3>
          </div>
        )}

        <div
          className="flex-1 overflow-y-auto px-5 py-4"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
