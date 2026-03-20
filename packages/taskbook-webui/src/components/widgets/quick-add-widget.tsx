import { CheckSquare, StickyNote } from "lucide-react";
import { useState } from "react";

interface QuickAddWidgetProps {
  boards: string[];
  onAdd: (description: string, isTask: boolean, board: string) => void;
}

export function QuickAddWidget({ boards, onAdd }: QuickAddWidgetProps) {
  const [text, setText] = useState("");
  const [isTask, setIsTask] = useState(true);
  const [board, setBoard] = useState(boards[0] ?? "My Board");

  function handleSubmit() {
    const desc = text.trim();
    if (!desc) return;
    onAdd(desc, isTask, board);
    setText("");
  }

  return (
    <div className="flex flex-col gap-2 h-full text-xs">
      {/* Input row */}
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          placeholder={isTask ? "Add a task…" : "Add a note…"}
          className="flex-1 min-w-0 rounded-lg px-3 py-2 outline-none"
          style={{
            backgroundColor: "var(--color-surface-hover)",
            color: "var(--color-text)",
            border: "1px solid var(--color-border)",
          }}
        />
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-2">
        {/* Type toggle */}
        <div
          className="flex rounded-lg overflow-hidden"
          style={{ border: "1px solid var(--color-border)" }}
        >
          <button
            type="button"
            onClick={() => setIsTask(true)}
            className="flex items-center gap-1 px-2 py-1 transition-colors"
            style={{
              backgroundColor: isTask ? "var(--color-accent)" : "transparent",
              color: isTask ? "var(--color-bg)" : "var(--color-text-muted)",
            }}
          >
            <CheckSquare size={12} />
            <span>Task</span>
          </button>
          <button
            type="button"
            onClick={() => setIsTask(false)}
            className="flex items-center gap-1 px-2 py-1 transition-colors"
            style={{
              backgroundColor: !isTask ? "var(--color-accent)" : "transparent",
              color: !isTask ? "var(--color-bg)" : "var(--color-text-muted)",
            }}
          >
            <StickyNote size={12} />
            <span>Note</span>
          </button>
        </div>

        {/* Board selector */}
        <select
          value={board}
          onChange={(e) => setBoard(e.target.value)}
          className="flex-1 min-w-0 rounded-lg px-2 py-1 outline-none text-xs"
          style={{
            backgroundColor: "var(--color-surface-hover)",
            color: "var(--color-text)",
            border: "1px solid var(--color-border)",
          }}
        >
          {boards.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
