use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};

use crate::error::Result;
use taskbook_common::board;

use super::super::app::{App, PendingAction, PopupState, StatusKind, ViewMode};
use super::super::autocomplete;
use super::item_ops;

/// Handle shortcut keys in normal (unfocused) mode.
pub(super) fn handle_shortcut_key(app: &mut App, key: KeyEvent) -> Result<()> {
    // Ctrl+D / Ctrl+U for half-page navigation
    if key.modifiers.contains(KeyModifiers::CONTROL) {
        match key.code {
            KeyCode::Char('d') => {
                let half = (app.content_height / 2).max(1) as usize;
                app.select_down_by(half);
            }
            KeyCode::Char('u') => {
                let half = (app.content_height / 2).max(1) as usize;
                app.select_up_by(half);
            }
            _ => {}
        }
        return Ok(());
    }

    match key.code {
        // Quit
        KeyCode::Char('q') => app.quit(),
        KeyCode::Esc => {
            if app.filter.search_term.is_some() {
                app.filter.search_term = None;
                app.update_display_order();
                app.selected_index = 0;
                app.set_status("Search cleared".to_string(), StatusKind::Info);
            } else if app.filter.board_filter.is_some() {
                app.clear_board_filter();
                app.set_status("Filter cleared".to_string(), StatusKind::Info);
            }
        }

        // Navigation
        KeyCode::Char('j') | KeyCode::Down => app.select_next(),
        KeyCode::Char('k') | KeyCode::Up => app.select_previous(),
        KeyCode::Char('g') => app.select_first(),
        KeyCode::Char('G') => app.select_last(),
        KeyCode::PageDown => {
            let page = app.content_height.max(1) as usize;
            app.select_down_by(page);
        }
        KeyCode::PageUp => {
            let page = app.content_height.max(1) as usize;
            app.select_up_by(page);
        }

        // Enter to open note in editor or filter by board
        KeyCode::Enter => {
            if let Some(item) = app.selected_item() {
                if !item.is_task() {
                    item_ops::edit_note_external(app, item.id())?;
                } else if app.view == ViewMode::Board && app.filter.board_filter.is_none() {
                    if let Some(board_name) = app.get_board_for_selected() {
                        let display = board::display_name(&board_name);
                        app.set_board_filter(Some(board_name));
                        app.set_status(format!("Filtering by {}", display), StatusKind::Info);
                    }
                }
            }
        }

        // View switching
        KeyCode::Char('1') => {
            app.clear_board_filter();
            app.set_view(ViewMode::Board)?;
        }
        KeyCode::Char('2') => {
            app.clear_board_filter();
            app.set_view(ViewMode::Timeline)?;
        }
        KeyCode::Char('3') => {
            app.clear_board_filter();
            app.set_view(ViewMode::Archive)?;
        }
        KeyCode::Char('4') => {
            app.clear_board_filter();
            app.set_view(ViewMode::Journal)?;
        }

        // Help
        KeyCode::Char('?') => {
            app.popup = Some(PopupState::Help { scroll: 0 });
        }

        // Slash or Tab activates command line
        KeyCode::Char('/') | KeyCode::Tab => {
            app.activate_command_line("/");
            autocomplete::update_suggestions(app);
        }

        // Pre-fill shortcuts — activate command line with partial command
        KeyCode::Char('t') if app.view != ViewMode::Archive => {
            if let Some(ref board) = app.filter.board_filter.clone() {
                app.activate_command_line(&format!("/task @{} ", board));
            } else {
                app.activate_command_line("/task @");
                autocomplete::update_suggestions(app);
            }
        }
        KeyCode::Char('n') if app.view != ViewMode::Archive => {
            if let Some(ref board) = app.filter.board_filter.clone() {
                app.activate_command_line(&format!("/note @{} ", board));
            } else {
                app.activate_command_line("/note @");
                autocomplete::update_suggestions(app);
            }
        }
        KeyCode::Char('e') if app.view != ViewMode::Archive => {
            if let Some(item) = app.selected_item() {
                let id = item.id();
                let desc = item.description().to_string();
                app.activate_command_line(&format!("/edit @{} {}", id, desc));
            }
        }
        KeyCode::Char('m') if app.view != ViewMode::Archive => {
            if let Some(id) = app.selected_id() {
                app.activate_command_line(&format!("/move @{} @", id));
                autocomplete::update_suggestions(app);
            }
        }
        KeyCode::Char('p') if app.view != ViewMode::Archive => {
            if let Some(item) = app.selected_item() {
                if item.is_task() {
                    app.activate_command_line(&format!("/priority @{} ", item.id()));
                }
            }
        }
        KeyCode::Char('d') if app.view != ViewMode::Archive => {
            if let Some(id) = app.selected_id() {
                app.command_line.pending_confirm = Some(PendingAction::Delete { ids: vec![id] });
            }
        }
        KeyCode::Char('C') if app.view != ViewMode::Archive => {
            app.command_line.pending_confirm = Some(PendingAction::Clear);
        }

        // Direct action shortcuts (no command line needed)
        KeyCode::Char('c') if app.view != ViewMode::Archive => {
            if let Some(id) = app.selected_id() {
                item_ops::toggle_check(app, id)?;
            }
        }
        KeyCode::Char('b') if app.view != ViewMode::Archive => {
            if let Some(id) = app.selected_id() {
                item_ops::toggle_begin(app, id)?;
            }
        }
        KeyCode::Char('s') if app.view != ViewMode::Archive => {
            if let Some(id) = app.selected_id() {
                item_ops::toggle_star(app, id)?;
            }
        }
        KeyCode::Char('r') if app.view == ViewMode::Archive => {
            if let Some(id) = app.selected_id() {
                item_ops::restore_item(app, id)?;
            }
        }
        KeyCode::Char('y') => {
            if let Some(id) = app.selected_id() {
                item_ops::copy_to_clipboard(app, id)?;
            }
        }

        // Cycle sort method
        KeyCode::Char('S') if app.view == ViewMode::Board => {
            app.cycle_sort_method();
            app.set_status(
                format!("Sort: {}", app.sort_method.display_name()),
                StatusKind::Info,
            );
        }
        // Toggle hide completed
        KeyCode::Char('h') if app.view != ViewMode::Archive => {
            app.toggle_hide_completed();
            let msg = if app.filter.hide_completed {
                "Hiding completed tasks"
            } else {
                "Showing completed tasks"
            };
            app.set_status(msg.to_string(), StatusKind::Info);
        }

        _ => {}
    }

    Ok(())
}
