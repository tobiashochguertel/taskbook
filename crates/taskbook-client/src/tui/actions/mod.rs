mod commands;
mod item_ops;
mod shortcuts;

use crossterm::event::{KeyCode, KeyEvent, MouseButton, MouseEvent, MouseEventKind};

use crate::error::Result;
use taskbook_common::board;

use super::app::{App, PendingAction, PopupState, StatusKind};
use super::autocomplete;
use super::command_parser;
use super::input_handler::{handle_text_input, InputResult};

/// Resolve a board name from an optional override, the current filter, or the default.
fn resolve_board(board: Option<String>, app: &App) -> String {
    board
        .map(|b| board::normalize_board_name(&b))
        .or_else(|| app.filter.board_filter.clone())
        .unwrap_or_else(|| "my board".to_string())
}

/// Handle a key event.
pub fn handle_key_event(app: &mut App, key: KeyEvent) -> Result<()> {
    // 1. Help popup → scroll with j/k/arrows, dismiss with q/Esc/other
    if let Some(PopupState::Help { ref mut scroll }) = app.popup {
        match key.code {
            KeyCode::Char('j') | KeyCode::Down => {
                *scroll = scroll.saturating_add(1);
            }
            KeyCode::Char('k') | KeyCode::Up => {
                *scroll = scroll.saturating_sub(1);
            }
            _ => {
                app.popup = None;
            }
        }
        return Ok(());
    }

    // 2. Pending confirm → Enter/Esc only
    if app.command_line.pending_confirm.is_some() {
        return handle_confirm_key(app, key);
    }

    // 3. Command line focused → handle command line input
    if app.command_line.focused {
        return handle_command_line_key(app, key);
    }

    // 4. Normal mode shortcuts
    shortcuts::handle_shortcut_key(app, key)
}

/// Handle keys when a confirmation is pending.
fn handle_confirm_key(app: &mut App, key: KeyEvent) -> Result<()> {
    match key.code {
        KeyCode::Enter => {
            if let Some(action) = app.command_line.pending_confirm.take() {
                match action {
                    PendingAction::Delete { ids } => {
                        item_ops::delete_items(app, &ids)?;
                    }
                    PendingAction::Clear => {
                        item_ops::clear_completed(app)?;
                    }
                    PendingAction::Reset { target } => {
                        let mut msgs = Vec::new();
                        if (target == "credentials" || target == "all")
                            && crate::credentials::Credentials::delete().is_ok()
                        {
                            msgs.push("credentials");
                        }
                        if target == "data" || target == "all" {
                            app.items.clear();
                            app.display_order.clear();
                            msgs.push("data");
                        }
                        if msgs.is_empty() {
                            app.set_status("Nothing to reset".to_string(), StatusKind::Info);
                        } else {
                            app.set_status(
                                format!("✔ Reset: {}", msgs.join(", ")),
                                StatusKind::Success,
                            );
                        }
                    }
                }
            }
            app.deactivate_command_line();
        }
        KeyCode::Esc => {
            app.command_line.pending_confirm = None;
            app.deactivate_command_line();
        }
        _ => {}
    }
    Ok(())
}

/// Handle keys when the command line is focused.
fn handle_command_line_key(app: &mut App, key: KeyEvent) -> Result<()> {
    // Tab accepts the selected suggestion
    if key.code == KeyCode::Tab {
        accept_suggestion(app);
        return Ok(());
    }

    // Up/Down navigate suggestions if visible, otherwise browse history
    match key.code {
        KeyCode::Up => {
            if !app.command_line.suggestions.is_empty() {
                let count = app.command_line.suggestions.len();
                app.command_line.selected_suggestion =
                    Some(match app.command_line.selected_suggestion {
                        None => count - 1,
                        Some(0) => count - 1,
                        Some(i) => i - 1,
                    });
            } else if !app.command_history.is_empty() {
                let new_idx = match app.history_index {
                    None => {
                        app.history_saved_input = app.command_line.input.clone();
                        app.command_history.len() - 1
                    }
                    Some(0) => 0,
                    Some(i) => i - 1,
                };
                app.history_index = Some(new_idx);
                let entry = app.command_history[new_idx].clone();
                app.command_line.cursor = entry.chars().count();
                app.command_line.input = entry;
                autocomplete::update_suggestions(app);
            }
            return Ok(());
        }
        KeyCode::Down => {
            if !app.command_line.suggestions.is_empty() {
                let count = app.command_line.suggestions.len();
                app.command_line.selected_suggestion =
                    Some(match app.command_line.selected_suggestion {
                        None => 0,
                        Some(i) if i + 1 >= count => 0,
                        Some(i) => i + 1,
                    });
            } else if let Some(idx) = app.history_index {
                if idx + 1 >= app.command_history.len() {
                    app.history_index = None;
                    let saved = app.history_saved_input.clone();
                    app.command_line.cursor = saved.chars().count();
                    app.command_line.input = saved;
                } else {
                    let new_idx = idx + 1;
                    app.history_index = Some(new_idx);
                    let entry = app.command_history[new_idx].clone();
                    app.command_line.cursor = entry.chars().count();
                    app.command_line.input = entry;
                }
                autocomplete::update_suggestions(app);
            }
            return Ok(());
        }
        _ => {}
    }

    // Use the existing text input handler for editing
    let input = app.command_line.input.clone();
    let cursor = app.command_line.cursor;

    match handle_text_input(key, &input, cursor) {
        InputResult::Cancel => {
            app.deactivate_command_line();
        }
        InputResult::Submit => {
            let input = app.command_line.input.clone();
            app.push_history(input.clone());
            app.deactivate_command_line();
            if !input.trim().is_empty() {
                execute_input(app, &input)?;
            }
        }
        InputResult::Changed {
            input: new_input,
            cursor: new_cursor,
        } => {
            app.command_line.input = new_input;
            app.command_line.cursor = new_cursor;
            autocomplete::update_suggestions(app);
        }
        InputResult::Ignored => {}
    }

    Ok(())
}

/// Accept the currently selected suggestion.
fn accept_suggestion(app: &mut App) {
    let selected = app.command_line.selected_suggestion.unwrap_or(0);
    if let Some(suggestion) = app.command_line.suggestions.get(selected).cloned() {
        app.command_line.input = suggestion.completion.clone();
        app.command_line.cursor = suggestion.completion.chars().count();
        app.command_line.suggestions.clear();
        app.command_line.selected_suggestion = None;
        autocomplete::update_suggestions(app);
    }
}

/// Parse and execute the command line input.
fn execute_input(app: &mut App, input: &str) -> Result<()> {
    match command_parser::parse_command(input) {
        Ok(cmd) => commands::execute_command(app, cmd),
        Err(e) => {
            app.set_status(e.message, StatusKind::Error);
            Ok(())
        }
    }
}

/// Handle a mouse event.
pub fn handle_mouse_event(app: &mut App, mouse: MouseEvent) -> Result<()> {
    match mouse.kind {
        MouseEventKind::Down(MouseButton::Left) => {
            let row = mouse.row;
            let terminal_height = app.content_height + 3;

            // Click on command line area (last 2 rows)
            if row >= terminal_height.saturating_sub(2) {
                if !app.command_line.focused {
                    app.activate_command_line("/");
                }
                return Ok(());
            }

            // Click in content area — map row to item index
            if row >= 1 && row < terminal_height.saturating_sub(2) {
                let content_row = (row - 1) as usize;
                if content_row < app.display_order.len() {
                    let now = std::time::Instant::now();
                    let was_selected = app.selected_index == content_row;
                    app.selected_index = content_row;

                    if was_selected {
                        if let Some(last) = app.last_click_time {
                            if now.duration_since(last).as_millis() < 400 {
                                // Double-click — open note in editor
                                if let Some(item) = app.selected_item() {
                                    if !item.is_task() {
                                        let id = item.id();
                                        item_ops::edit_note_external(app, id)?;
                                    }
                                }
                                app.last_click_time = None;
                                return Ok(());
                            }
                        }
                    }
                    app.last_click_time = Some(now);
                }
            }
        }
        MouseEventKind::ScrollDown => {
            app.select_next();
        }
        MouseEventKind::ScrollUp => {
            app.select_previous();
        }
        _ => {}
    }
    Ok(())
}
