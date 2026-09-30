import type { StorageItem } from "../../lib/types";
import { AllBoardsView } from "../ui/all-boards-view";

interface AllBoardsWidgetProps {
  items: StorageItem[];
  onToggleComplete: (item: StorageItem) => void;
  onToggleStar: (item: StorageItem) => void;
  onDelete: (item: StorageItem) => void;
  onEdit: (item: StorageItem, newDescription: string) => void;
  onToggleProgress: (item: StorageItem) => void;
  onChangePriority: (item: StorageItem, newPriority: number) => void;
  onMoveToBoard: (item: StorageItem, targetBoard: string) => void;
  onUpdateTags: (item: StorageItem, newTags: string[]) => void;
  onArchive: (item: StorageItem) => void;
  boards: string[];
}

export function AllBoardsWidget(props: AllBoardsWidgetProps) {
  return (
    <div className="overflow-y-auto h-full">
      <AllBoardsView {...props} />
    </div>
  );
}
