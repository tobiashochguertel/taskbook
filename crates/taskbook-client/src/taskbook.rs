use std::collections::{HashMap, HashSet};
use std::path::Path;

use arboard::Clipboard;

use crate::config::Config;
use crate::directory::resolve_taskbook_directory;
use crate::editor;
use crate::error::{Result, TaskbookError};
use crate::render::Stats;
use crate::storage::{LocalStorage, RemoteStorage, StorageBackend};
use taskbook_common::board::{self, DEFAULT_BOARD};
use taskbook_common::{Note, StorageItem, Task};

/// Result of a toggle operation (check/begin/star).
/// `on` contains IDs toggled to the active state, `off` to the inactive state.
pub struct ToggleResult {
    pub on: Vec<u64>,
    pub off: Vec<u64>,
}

/// Result of an editor-based operation (create note, edit note).
pub enum EditorResult {
    Created(u64),
    Edited(u64),
    Cancelled,
}

pub struct Taskbook {
    storage: Box<dyn StorageBackend>,
}

impl Taskbook {
    pub fn new(taskbook_dir: Option<&Path>) -> Result<Self> {
        let config = Config::load_or_default();

        let storage: Box<dyn StorageBackend> = if config.sync.enabled {
            Box::new(RemoteStorage::new(&config.sync.server_url)?)
        } else {
            let resolved_dir = resolve_taskbook_directory(taskbook_dir)?;
            Box::new(LocalStorage::new(&resolved_dir)?)
        };

        Ok(Self { storage })
    }

    fn get_data(&self) -> Result<HashMap<String, StorageItem>> {
        self.storage.get()
    }

    fn get_archive(&self) -> Result<HashMap<String, StorageItem>> {
        self.storage.get_archive()
    }

    fn save(&self, data: &HashMap<String, StorageItem>) -> Result<()> {
        self.storage.set(data)
    }

    fn save_archive(&self, data: &HashMap<String, StorageItem>) -> Result<()> {
        self.storage.set_archive(data)
    }

    fn generate_id(&self, data: &HashMap<String, StorageItem>) -> u64 {
        let max = data
            .keys()
            .filter_map(|k| k.parse::<u64>().ok())
            .max()
            .unwrap_or(0);
        max + 1
    }

    fn remove_duplicates(&self, ids: &[u64]) -> Vec<u64> {
        let mut seen = HashSet::with_capacity(ids.len());
        ids.iter().filter(|id| seen.insert(**id)).copied().collect()
    }

    pub fn get_ids(&self, data: &HashMap<String, StorageItem>) -> HashSet<u64> {
        data.keys().filter_map(|k| k.parse::<u64>().ok()).collect()
    }

    /// Validate IDs exist in data, returning deduplicated valid IDs.
    pub fn validate_ids(&self, input_ids: &[u64], existing_ids: &HashSet<u64>) -> Result<Vec<u64>> {
        if input_ids.is_empty() {
            return Err(TaskbookError::InvalidId(0));
        }

        let unique_ids = self.remove_duplicates(input_ids);

        for id in &unique_ids {
            if !existing_ids.contains(id) {
                return Err(TaskbookError::InvalidId(*id));
            }
        }

        Ok(unique_ids)
    }

    pub fn get_boards(&self, data: &HashMap<String, StorageItem>) -> Vec<String> {
        let mut boards = vec![DEFAULT_BOARD.to_string()];

        // Iterate items in ID order for deterministic board discovery
        let mut items: Vec<_> = data.iter().collect();
        items.sort_by_key(|(k, _)| k.parse::<u64>().unwrap_or(u64::MAX));

        for (_, item) in &items {
            for b in item.boards() {
                if !boards.iter().any(|existing| board::board_eq(existing, b)) {
                    boards.push(b.clone());
                }
            }
        }

        // Sort non-default boards alphabetically (case-insensitive), keeping default first
        if boards.len() > 1 {
            boards[1..].sort_by_key(|a| a.to_lowercase());
        }

        boards
    }

    pub fn get_stats(&self, data: &HashMap<String, StorageItem>) -> Stats {
        let mut complete = 0;
        let mut in_progress = 0;
        let mut pending = 0;
        let mut notes = 0;

        for item in data.values() {
            if let Some(task) = item.as_task() {
                if task.is_complete {
                    complete += 1;
                } else if task.in_progress {
                    in_progress += 1;
                } else {
                    pending += 1;
                }
            } else {
                notes += 1;
            }
        }

        let total = complete + pending + in_progress;
        let percent = if total == 0 {
            0
        } else {
            (complete * 100 / total) as u32
        };

        Stats {
            percent,
            complete,
            in_progress,
            pending,
            notes,
        }
    }

    pub fn item_matches_terms(item: &StorageItem, terms: &[String]) -> bool {
        for term in terms {
            let term_lower = term.to_lowercase();

            // Check if searching by tag (+tag syntax)
            if let Some(tag_query) = term_lower.strip_prefix('+') {
                if item
                    .tags()
                    .iter()
                    .any(|t| t.to_lowercase().contains(tag_query))
                {
                    return true;
                }
                continue;
            }

            // Search description
            if item.description().to_lowercase().contains(&term_lower) {
                return true;
            }

            // Search note body
            if let Some(body) = item.note_body() {
                if body.to_lowercase().contains(&term_lower) {
                    return true;
                }
            }

            // Search tags
            if item
                .tags()
                .iter()
                .any(|t| t.to_lowercase().contains(&term_lower))
            {
                return true;
            }
        }
        false
    }

    fn filter_items(
        data: &mut HashMap<String, StorageItem>,
        predicate: impl Fn(&StorageItem) -> bool,
    ) {
        data.retain(|_, item| predicate(item));
    }

    fn filter_by_attributes(&self, attrs: &[String], data: &mut HashMap<String, StorageItem>) {
        for attr in attrs {
            match attr.as_str() {
                "star" | "starred" => Self::filter_items(data, |item| item.is_starred()),
                "done" | "checked" | "complete" => {
                    Self::filter_items(data, |item| item.as_task().is_some_and(|t| t.is_complete));
                }
                "progress" | "started" | "begun" => {
                    Self::filter_items(data, |item| item.as_task().is_some_and(|t| t.in_progress));
                }
                "pending" | "unchecked" | "incomplete" => {
                    Self::filter_items(data, |item| {
                        item.as_task()
                            .is_some_and(|t| !t.is_complete && !t.in_progress)
                    });
                }
                "todo" | "task" | "tasks" => Self::filter_items(data, |item| item.is_task()),
                "note" | "notes" => Self::filter_items(data, |item| !item.is_task()),
                _ => {}
            }
        }
    }

    pub fn group_by_board<'a>(
        &self,
        data: &'a HashMap<String, StorageItem>,
        boards: &[String],
    ) -> HashMap<String, Vec<&'a StorageItem>> {
        let mut grouped: HashMap<String, Vec<&StorageItem>> = HashMap::new();

        for item in data.values() {
            for board in boards {
                if item.boards().iter().any(|b| board::board_eq(b, board)) {
                    grouped.entry(board.clone()).or_default().push(item);
                }
            }
        }

        grouped
    }

    pub fn group_by_date<'a>(
        &self,
        data: &'a HashMap<String, StorageItem>,
    ) -> HashMap<String, Vec<&'a StorageItem>> {
        let mut grouped: HashMap<String, Vec<&StorageItem>> = HashMap::new();

        for item in data.values() {
            let date = item.date().to_string();
            grouped.entry(date).or_default().push(item);
        }

        grouped
    }

    fn save_item_to_archive(&self, item: StorageItem) -> Result<()> {
        let mut archive = self.get_archive()?;
        let archive_id = self.generate_id(&archive);

        let mut item = item;
        match &mut item {
            StorageItem::Task(t) => t.id = archive_id,
            StorageItem::Note(n) => n.id = archive_id,
        }

        archive.insert(archive_id.to_string(), item);
        self.save_archive(&archive)
    }

    fn save_item_to_storage(&self, item: StorageItem) -> Result<()> {
        let mut data = self.get_data()?;
        let restore_id = self.generate_id(&data);

        let mut item = item;
        match &mut item {
            StorageItem::Task(t) => t.id = restore_id,
            StorageItem::Note(n) => n.id = restore_id,
        }

        data.insert(restore_id.to_string(), item);
        self.save(&data)
    }

    // Public API methods for TUI access

    /// Get all items without rendering (for TUI)
    pub fn get_all_items(&self) -> Result<HashMap<String, StorageItem>> {
        self.get_data()
    }

    /// Get all archived items without rendering (for TUI)
    pub fn get_all_archive_items(&self) -> Result<HashMap<String, StorageItem>> {
        self.get_archive()
    }

    /// Get all boards (for TUI)
    pub fn get_all_boards(&self) -> Result<Vec<String>> {
        let data = self.get_data()?;
        Ok(self.get_boards(&data))
    }

    // Silent methods for TUI (no render output)

    /// Create a task with explicit board and description (for TUI)
    #[allow(dead_code)]
    pub fn create_task_direct(
        &self,
        boards: Vec<String>,
        description: String,
        priority: u8,
    ) -> Result<u64> {
        self.create_task_direct_with_tags(boards, description, priority, Vec::new())
    }

    /// Create a task with tags (for TUI)
    pub fn create_task_direct_with_tags(
        &self,
        boards: Vec<String>,
        description: String,
        priority: u8,
        tags: Vec<String>,
    ) -> Result<u64> {
        if description.is_empty() {
            return Err(TaskbookError::General("Description cannot be empty".into()));
        }

        let mut data = self.get_data()?;
        let id = self.generate_id(&data);
        let task = Task::new_with_tags(id, description, boards, priority, tags);
        data.insert(id.to_string(), StorageItem::Task(task));
        self.save(&data)?;
        Ok(id)
    }

    /// Create a note with explicit board and description (for TUI)
    #[allow(dead_code)]
    pub fn create_note_direct(&self, boards: Vec<String>, description: String) -> Result<u64> {
        self.create_note_direct_with_tags(boards, description, Vec::new())
    }

    /// Create a note with tags (for TUI)
    pub fn create_note_direct_with_tags(
        &self,
        boards: Vec<String>,
        description: String,
        tags: Vec<String>,
    ) -> Result<u64> {
        if description.is_empty() {
            return Err(TaskbookError::General("Description cannot be empty".into()));
        }

        let mut data = self.get_data()?;
        let id = self.generate_id(&data);
        let note = Note::new_with_tags(id, description, boards, tags);
        data.insert(id.to_string(), StorageItem::Note(note));
        self.save(&data)?;
        Ok(id)
    }

    /// Create a note with title and body (for TUI)
    #[allow(dead_code)]
    pub fn create_note_with_body_direct(
        &self,
        boards: Vec<String>,
        title: String,
        body: Option<String>,
    ) -> Result<u64> {
        if title.is_empty() {
            return Err(TaskbookError::InvalidId(0));
        }

        let mut data = self.get_data()?;
        let id = self.generate_id(&data);
        let note = Note::new_with_body(id, title, body, boards);
        data.insert(id.to_string(), StorageItem::Note(note));
        self.save(&data)?;
        Ok(id)
    }

    /// Edit note body without CLI output (for TUI)
    pub fn edit_note_body_silent(&self, id: u64, body: Option<String>) -> Result<()> {
        let mut data = self.get_data()?;
        let existing_ids = self.get_ids(&data);
        self.validate_ids(&[id], &existing_ids)?;

        if let Some(item) = data.get_mut(&id.to_string()) {
            if !item.set_note_body(body) {
                return Err(TaskbookError::General("Item is not a note".to_string()));
            }
        }

        self.save(&data)
    }

    /// Generic helper: validate IDs, apply a modifier to each item, and save.
    /// Returns the list of validated IDs that were processed.
    fn modify_items<F>(&self, ids: &[u64], modifier: F) -> Result<Vec<u64>>
    where
        F: Fn(&mut StorageItem),
    {
        let mut data = self.get_data()?;
        let existing_ids = self.get_ids(&data);
        let validated_ids = self.validate_ids(ids, &existing_ids)?;

        for id in &validated_ids {
            if let Some(item) = data.get_mut(&id.to_string()) {
                modifier(item);
            }
        }

        self.save(&data)?;
        Ok(validated_ids)
    }

    /// Check/uncheck tasks (for TUI and CLI)
    pub fn check_tasks_silent(&self, ids: &[u64]) -> Result<()> {
        self.modify_items(ids, |item| {
            if let Some(task) = item.as_task_mut() {
                task.in_progress = false;
                task.is_complete = !task.is_complete;
            }
        })?;
        Ok(())
    }

    /// Begin/pause tasks (for TUI and CLI)
    pub fn begin_tasks_silent(&self, ids: &[u64]) -> Result<()> {
        self.modify_items(ids, |item| {
            if let Some(task) = item.as_task_mut() {
                task.is_complete = false;
                task.in_progress = !task.in_progress;
            }
        })?;
        Ok(())
    }

    /// Star/unstar items (for TUI and CLI)
    pub fn star_items_silent(&self, ids: &[u64]) -> Result<()> {
        self.modify_items(ids, |item| {
            let new_starred = !item.is_starred();
            item.set_starred(new_starred);
        })?;
        Ok(())
    }

    /// Delete items, moving them to archive.
    pub fn delete_items_silent(&self, ids: &[u64]) -> Result<Vec<u64>> {
        let mut data = self.get_data()?;
        let existing_ids = self.get_ids(&data);
        let validated_ids = self.validate_ids(ids, &existing_ids)?;

        for id in &validated_ids {
            if let Some(item) = data.remove(&id.to_string()) {
                self.save_item_to_archive(item)?;
            }
        }

        self.save(&data)?;
        Ok(validated_ids)
    }

    /// Restore items from archive.
    pub fn restore_items_silent(&self, ids: &[u64]) -> Result<Vec<u64>> {
        let mut archive = self.get_archive()?;
        let archive_ids = self.get_ids(&archive);
        let validated_ids = self.validate_ids(ids, &archive_ids)?;

        for id in &validated_ids {
            if let Some(item) = archive.remove(&id.to_string()) {
                self.save_item_to_storage(item)?;
            }
        }

        self.save_archive(&archive)?;
        Ok(validated_ids)
    }

    /// Edit description (for TUI and CLI)
    pub fn edit_description_silent(&self, id: u64, new_desc: &str) -> Result<()> {
        let desc = new_desc.to_string();
        self.modify_items(&[id], |item| {
            item.set_description(desc.clone());
        })?;
        Ok(())
    }

    /// Move to board (for TUI and CLI)
    pub fn move_boards_silent(&self, id: u64, boards: Vec<String>) -> Result<()> {
        let normalized: Vec<String> = boards
            .into_iter()
            .map(|b| board::normalize_board_name(&b))
            .collect();
        self.modify_items(&[id], |item| {
            item.set_boards(normalized.clone());
        })?;
        Ok(())
    }

    /// Update priority (for TUI and CLI)
    pub fn update_priority_silent(&self, id: u64, priority: u8) -> Result<()> {
        self.modify_items(&[id], |item| {
            if let Some(task) = item.as_task_mut() {
                task.priority = priority;
            }
        })?;
        Ok(())
    }

    /// Clear completed tasks, moving them to archive. Returns deleted IDs.
    pub fn clear_silent(&self) -> Result<Vec<u64>> {
        let data = self.get_data()?;
        let mut ids_to_delete: Vec<u64> = Vec::new();

        for (id, item) in &data {
            if let Some(task) = item.as_task() {
                if task.is_complete {
                    if let Ok(id) = id.parse::<u64>() {
                        ids_to_delete.push(id);
                    }
                }
            }
        }

        if ids_to_delete.is_empty() {
            return Ok(vec![]);
        }

        let mut data = self.get_data()?;
        for id in &ids_to_delete {
            if let Some(item) = data.remove(&id.to_string()) {
                self.save_item_to_archive(item)?;
            }
        }
        self.save(&data)?;
        Ok(ids_to_delete)
    }

    /// Copy to clipboard without CLI output (for TUI)
    pub fn copy_to_clipboard_silent(&self, ids: &[u64]) -> Result<()> {
        let data = self.get_data()?;
        let existing_ids = self.get_ids(&data);
        let validated_ids = self.validate_ids(ids, &existing_ids)?;

        let descriptions: Vec<String> = validated_ids
            .iter()
            .filter_map(|id| data.get(&id.to_string()))
            .map(|item| item.description().to_string())
            .collect();

        if descriptions.is_empty() {
            return Err(TaskbookError::NoItemsToCopy);
        }

        let mut clipboard =
            Clipboard::new().map_err(|e| TaskbookError::Clipboard(e.to_string()))?;
        clipboard
            .set_text(descriptions.join("\n"))
            .map_err(|e| TaskbookError::Clipboard(e.to_string()))?;

        Ok(())
    }

    /// Rename a board across all items (for TUI)
    pub fn rename_board_silent(&self, old_name: &str, new_name: &str) -> Result<usize> {
        let mut data = self.get_data()?;
        let mut count = 0;
        let normalized_new = board::normalize_board_name(new_name);

        for item in data.values_mut() {
            let boards = item.boards().to_vec();
            if boards.iter().any(|b| board::board_eq(b, old_name)) {
                let new_boards: Vec<String> = boards
                    .iter()
                    .map(|b| {
                        if board::board_eq(b, old_name) {
                            normalized_new.clone()
                        } else {
                            b.clone()
                        }
                    })
                    .collect();
                item.set_boards(new_boards);
                count += 1;
            }
        }

        if count > 0 {
            self.save(&data)?;
        }

        Ok(count)
    }

    // Public API methods (return data, no rendering)

    /// Create a note, returning the created ID.
    pub fn create_note(
        &self,
        boards: Vec<String>,
        description: String,
        tags: Vec<String>,
    ) -> Result<u64> {
        self.create_note_direct_with_tags(boards, description, tags)
    }

    /// Create a note using external editor, returning the result.
    pub fn create_note_with_editor(&self) -> Result<EditorResult> {
        let content = editor::create_note_in_editor()?;

        match content {
            Some(note_content) => {
                let mut data = self.get_data()?;
                let id = self.generate_id(&data);
                let note = Note::new_with_body(
                    id,
                    note_content.title,
                    note_content.body,
                    vec![DEFAULT_BOARD.to_string()],
                );
                data.insert(id.to_string(), StorageItem::Note(note));
                self.save(&data)?;
                Ok(EditorResult::Created(id))
            }
            None => Ok(EditorResult::Cancelled),
        }
    }

    /// Edit an existing note in external editor, returning the result.
    pub fn edit_note_in_editor(&self, id: u64) -> Result<EditorResult> {
        let data = self.get_data()?;
        let existing_ids = self.get_ids(&data);
        let validated_ids = self.validate_ids(&[id], &existing_ids)?;
        let id = validated_ids[0];

        let item = data
            .get(&id.to_string())
            .ok_or(TaskbookError::InvalidId(id))?;

        let note = item
            .as_note()
            .ok_or_else(|| TaskbookError::General("Item is not a note".to_string()))?;

        let content = editor::edit_existing_note_in_editor(note.title(), note.body())?;

        match content {
            Some(note_content) => {
                let mut data = self.get_data()?;
                if let Some(item) = data.get_mut(&id.to_string()) {
                    item.set_description(note_content.title);
                    item.set_note_body(note_content.body);
                }
                self.save(&data)?;
                Ok(EditorResult::Edited(id))
            }
            None => Ok(EditorResult::Cancelled),
        }
    }

    /// Create a task, returning the created ID.
    pub fn create_task(
        &self,
        boards: Vec<String>,
        description: String,
        priority: u8,
        tags: Vec<String>,
    ) -> Result<u64> {
        self.create_task_direct_with_tags(boards, description, priority, tags)
    }

    /// Check/uncheck tasks, returning which were toggled on/off.
    pub fn check_tasks(&self, ids: &[u64]) -> Result<ToggleResult> {
        self.check_tasks_silent(ids)?;
        let data = self.get_data()?;

        let mut on = Vec::new();
        let mut off = Vec::new();
        for id in ids {
            if let Some(item) = data.get(&id.to_string()) {
                if let Some(task) = item.as_task() {
                    if task.is_complete {
                        on.push(*id);
                    } else {
                        off.push(*id);
                    }
                }
            }
        }

        Ok(ToggleResult { on, off })
    }

    /// Begin/pause tasks, returning which were toggled on/off.
    pub fn begin_tasks(&self, ids: &[u64]) -> Result<ToggleResult> {
        self.begin_tasks_silent(ids)?;
        let data = self.get_data()?;

        let mut on = Vec::new();
        let mut off = Vec::new();
        for id in ids {
            if let Some(item) = data.get(&id.to_string()) {
                if let Some(task) = item.as_task() {
                    if task.in_progress {
                        on.push(*id);
                    } else {
                        off.push(*id);
                    }
                }
            }
        }

        Ok(ToggleResult { on, off })
    }

    /// Star/unstar items, returning which were toggled on/off.
    pub fn star_items(&self, ids: &[u64]) -> Result<ToggleResult> {
        self.star_items_silent(ids)?;
        let data = self.get_data()?;

        let mut on = Vec::new();
        let mut off = Vec::new();
        for id in ids {
            if let Some(item) = data.get(&id.to_string()) {
                if item.is_starred() {
                    on.push(*id);
                } else {
                    off.push(*id);
                }
            }
        }

        Ok(ToggleResult { on, off })
    }

    /// Copy item descriptions to clipboard, returning copied IDs.
    pub fn copy_to_clipboard(&self, ids: &[u64]) -> Result<Vec<u64>> {
        let data = self.get_data()?;
        let existing_ids = self.get_ids(&data);
        let validated_ids = self.validate_ids(ids, &existing_ids)?;

        let descriptions: Vec<String> = validated_ids
            .iter()
            .filter_map(|id| data.get(&id.to_string()))
            .map(|item| item.description().to_string())
            .collect();

        if descriptions.is_empty() {
            return Err(TaskbookError::NoItemsToCopy);
        }

        let mut clipboard =
            Clipboard::new().map_err(|e| TaskbookError::Clipboard(e.to_string()))?;
        clipboard
            .set_text(descriptions.join("\n"))
            .map_err(|e| TaskbookError::Clipboard(e.to_string()))?;

        Ok(validated_ids)
    }

    /// Find items matching search terms, returning matching items.
    pub fn find_items(&self, terms: &[String]) -> Result<HashMap<String, StorageItem>> {
        let data = self.get_data()?;
        Ok(data
            .into_iter()
            .filter(|(_, item)| Self::item_matches_terms(item, terms))
            .collect())
    }

    /// Filter items by attributes/boards/tags, returning filtered data and display boards.
    pub fn list_by_attributes(
        &self,
        terms: &[String],
    ) -> Result<(HashMap<String, StorageItem>, Vec<String>)> {
        let data = self.get_data()?;
        let stored_boards = self.get_boards(&data);

        let mut boards: Vec<String> = Vec::new();
        let mut attributes: Vec<String> = Vec::new();
        let mut tag_filters: Vec<String> = Vec::new();

        for term in terms {
            if term.starts_with('+') && term.len() > 1 {
                tag_filters.push(board::normalize_tag(term));
            } else {
                let normalized = board::normalize_board_name(term);
                if stored_boards
                    .iter()
                    .any(|b| board::board_eq(b, &normalized))
                {
                    if !boards.iter().any(|b| board::board_eq(b, &normalized)) {
                        boards.push(normalized);
                    }
                } else {
                    attributes.push(term.clone());
                }
            }
        }

        let mut filtered_data = data.clone();
        self.filter_by_attributes(&attributes, &mut filtered_data);

        if !tag_filters.is_empty() {
            filtered_data.retain(|_, item| {
                tag_filters.iter().all(|filter_tag| {
                    item.tags()
                        .iter()
                        .any(|t| t.eq_ignore_ascii_case(filter_tag))
                })
            });
        }

        let display_boards = if boards.is_empty() {
            self.get_boards(&filtered_data)
        } else {
            boards
        };

        Ok((filtered_data, display_boards))
    }

    /// Update tags (for TUI and CLI)
    pub fn update_tags_silent(
        &self,
        id: u64,
        add_tags: &[String],
        remove_tags: &[String],
    ) -> Result<()> {
        let add = add_tags.to_vec();
        let remove = remove_tags.to_vec();
        self.modify_items(&[id], |item| {
            let mut current_tags: Vec<String> = item.tags().to_vec();

            current_tags.retain(|t| !remove.iter().any(|r| t.eq_ignore_ascii_case(r)));

            for tag in &add {
                if !current_tags.iter().any(|t| t.eq_ignore_ascii_case(tag)) {
                    current_tags.push(tag.clone());
                }
            }

            item.set_tags(current_tags);
        })?;
        Ok(())
    }
}
