use crate::editor;
use crate::error::Result;
use taskbook_common::board;

use super::super::app::{App, StatusKind, ViewMode};

pub(super) fn toggle_check(app: &mut App, id: u64) -> Result<()> {
    if let Some(item) = app.items.get(&id.to_string()) {
        if item.is_task() {
            app.taskbook.check_tasks_silent(&[id])?;
            app.refresh_items()?;
            app.set_status(format!("Toggled task {}", id), StatusKind::Success);
        }
    }
    Ok(())
}

pub(super) fn toggle_begin(app: &mut App, id: u64) -> Result<()> {
    if let Some(item) = app.items.get(&id.to_string()) {
        if item.is_task() {
            app.taskbook.begin_tasks_silent(&[id])?;
            app.refresh_items()?;
            app.set_status(
                format!("Toggled in-progress for task {}", id),
                StatusKind::Success,
            );
        }
    }
    Ok(())
}

pub(super) fn toggle_star(app: &mut App, id: u64) -> Result<()> {
    app.taskbook.star_items_silent(&[id])?;
    app.refresh_items()?;
    app.set_status(format!("Toggled star for item {}", id), StatusKind::Success);
    Ok(())
}

pub(super) fn edit_description(app: &mut App, id: u64, new_desc: &str) -> Result<()> {
    app.taskbook.edit_description_silent(id, new_desc)?;
    app.refresh_items()?;
    app.set_status(format!("Updated item {}", id), StatusKind::Success);
    Ok(())
}

pub(super) fn move_to_board(app: &mut App, id: u64, board: &str) -> Result<()> {
    let board_name = board::normalize_board_name(board);
    app.taskbook
        .move_boards_silent(id, vec![board_name.clone()])?;
    app.refresh_items()?;
    let display = board::display_name(&board_name);
    app.set_status(
        format!("Moved item {} to {}", id, display),
        StatusKind::Success,
    );
    Ok(())
}

pub(super) fn set_priority(app: &mut App, id: u64, priority: u8) -> Result<()> {
    app.taskbook.update_priority_silent(id, priority)?;
    app.refresh_items()?;
    app.set_status(
        format!("Set priority {} for task {}", priority, id),
        StatusKind::Success,
    );
    Ok(())
}

pub(super) fn delete_items(app: &mut App, ids: &[u64]) -> Result<()> {
    app.taskbook.delete_items_silent(ids)?;
    app.refresh_items()?;
    app.set_status(
        format!("Deleted {} item(s)", ids.len()),
        StatusKind::Success,
    );
    Ok(())
}

pub(super) fn restore_item(app: &mut App, id: u64) -> Result<()> {
    app.taskbook.restore_items_silent(&[id])?;
    app.set_view(ViewMode::Archive)?;
    app.set_status(format!("Restored item {}", id), StatusKind::Success);
    Ok(())
}

pub(super) fn copy_to_clipboard(app: &mut App, id: u64) -> Result<()> {
    app.taskbook.copy_to_clipboard_silent(&[id])?;
    app.set_status(
        format!("Copied item {} to clipboard", id),
        StatusKind::Success,
    );
    Ok(())
}

pub(super) fn update_tags(app: &mut App, id: u64, add: &[String], remove: &[String]) -> Result<()> {
    app.taskbook.update_tags_silent(id, add, remove)?;
    app.refresh_items()?;
    let mut parts = Vec::new();
    if !add.is_empty() {
        let tags_str = add
            .iter()
            .map(|t| format!("+{}", t))
            .collect::<Vec<_>>()
            .join(" ");
        parts.push(format!("added {}", tags_str));
    }
    if !remove.is_empty() {
        let tags_str = remove
            .iter()
            .map(|t| format!("-{}", t))
            .collect::<Vec<_>>()
            .join(" ");
        parts.push(format!("removed {}", tags_str));
    }
    app.set_status(
        format!("Tags on item {}: {}", id, parts.join(", ")),
        StatusKind::Success,
    );
    Ok(())
}

pub(super) fn clear_completed(app: &mut App) -> Result<()> {
    let cleared_ids = app.taskbook.clear_silent()?;
    app.refresh_items()?;
    app.set_status(
        format!("Cleared {} completed task(s)", cleared_ids.len()),
        StatusKind::Success,
    );
    Ok(())
}

pub(super) fn rename_board(app: &mut App, old_name: &str, new_name: &str) -> Result<()> {
    let new_board = board::normalize_board_name(new_name);
    let count = app.taskbook.rename_board_silent(old_name, &new_board)?;

    if let Some(ref filter) = app.filter.board_filter {
        if board::board_eq(filter, old_name) {
            app.filter.board_filter = Some(new_board.clone());
        }
    }

    app.refresh_items()?;
    let old_display = board::display_name(old_name);
    let new_display = board::display_name(&new_board);
    app.set_status(
        format!(
            "Renamed {} to {} ({} items)",
            old_display, new_display, count
        ),
        StatusKind::Success,
    );
    Ok(())
}

pub(super) fn edit_note_external(app: &mut App, id: u64) -> Result<()> {
    let item = app.items.get(&id.to_string());
    let note = match item.and_then(|i| i.as_note()) {
        Some(n) => n,
        None => {
            app.set_status("Item is not a note".to_string(), StatusKind::Error);
            return Ok(());
        }
    };

    let title = note.title().to_string();
    let body = note.body().map(|s| s.to_string());

    // Suspend TUI to run external editor
    let guard = super::super::suspend_tui()?;

    // Open external editor
    let content = editor::edit_existing_note_in_editor(&title, body.as_deref());

    // Resume TUI
    guard.resume()?;

    // After suspend/resume, ratatui's internal buffer is stale — force full redraw
    app.needs_full_redraw = true;

    match content? {
        Some(note_content) => {
            app.taskbook
                .edit_description_silent(id, &note_content.title)?;
            app.taskbook.edit_note_body_silent(id, note_content.body)?;
            app.refresh_items()?;
            app.set_status(format!("Updated note {}", id), StatusKind::Success);
        }
        None => {
            app.set_status("Edit cancelled".to_string(), StatusKind::Info);
        }
    }

    Ok(())
}
