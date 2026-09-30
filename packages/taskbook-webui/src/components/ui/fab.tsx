import { Plus } from "lucide-react";

interface FabProps {
  onClick: () => void;
  /** Extra bottom offset for tab bar */
  bottomOffset?: number;
}

export function Fab({ onClick, bottomOffset = 0 }: FabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed z-30 flex items-center justify-center rounded-full shadow-lg cursor-pointer border-none transition-transform active:scale-90"
      style={{
        width: 56,
        height: 56,
        right: "max(1rem, env(safe-area-inset-right, 1rem))",
        bottom: `calc(${bottomOffset}px + max(1rem, env(safe-area-inset-bottom, 1rem)))`,
        backgroundColor: "var(--color-accent)",
        color: "var(--color-bg)",
      }}
      aria-label="Create new item"
    >
      <Plus size={24} />
    </button>
  );
}
