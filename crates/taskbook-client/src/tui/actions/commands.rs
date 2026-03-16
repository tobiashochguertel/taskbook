use crate::error::Result;
use taskbook_common::board;

use super::super::app::{App, PendingAction, PopupState, StatusKind, ViewMode};
use super::super::command_parser::ParsedCommand;
use super::item_ops;
use super::resolve_board;

/// Execute a parsed command.
pub(super) fn execute_command(app: &mut App, cmd: ParsedCommand) -> Result<()> {
    match cmd {
        ParsedCommand::Task {
            board,
            description,
            priority,
            tags,
        } => {
            let board_name = resolve_board(board, app);
            app.taskbook.create_task_direct_with_tags(
                vec![board_name.clone()],
                description,
                priority,
                tags,
            )?;
            app.refresh_items()?;
            let display = board::display_name(&board_name);
            app.set_status(format!("Task created in {}", display), StatusKind::Success);
        }
        ParsedCommand::Note {
            board,
            description,
            tags,
        } => {
            let board_name = resolve_board(board, app);
            app.taskbook.create_note_direct_with_tags(
                vec![board_name.clone()],
                description,
                tags,
            )?;
            app.refresh_items()?;
            let display = board::display_name(&board_name);
            app.set_status(format!("Note created in {}", display), StatusKind::Success);

            // Open editor for the newly created note
            if let Some(max_id) = app.items.values().map(|i| i.id()).max() {
                if let Some(item) = app.items.get(&max_id.to_string()) {
                    if !item.is_task() {
                        item_ops::edit_note_external(app, max_id)?;
                    }
                }
            }
        }
        ParsedCommand::Edit { id, description } => {
            item_ops::edit_description(app, id, &description)?;
        }
        ParsedCommand::Move { id, board } => {
            item_ops::move_to_board(app, id, &board)?;
        }
        ParsedCommand::Delete { ids } => {
            app.command_line.pending_confirm = Some(PendingAction::Delete { ids });
        }
        ParsedCommand::Search { term } => {
            app.filter.search_term = Some(term.clone());
            app.update_display_order();
            app.selected_index = 0;
            let count = app.display_order.len();
            app.set_status(
                format!("Search: \"{}\" ({} matches)", term, count),
                StatusKind::Info,
            );
        }
        ParsedCommand::Priority { id, level } => {
            item_ops::set_priority(app, id, level)?;
        }
        ParsedCommand::Check { ids } => {
            for id in &ids {
                item_ops::toggle_check(app, *id)?;
            }
        }
        ParsedCommand::Star { ids } => {
            for id in &ids {
                item_ops::toggle_star(app, *id)?;
            }
        }
        ParsedCommand::Begin { ids } => {
            for id in &ids {
                item_ops::toggle_begin(app, *id)?;
            }
        }
        ParsedCommand::Tag { id, add, remove } => {
            item_ops::update_tags(app, id, &add, &remove)?;
        }
        ParsedCommand::Clear => {
            app.command_line.pending_confirm = Some(PendingAction::Clear);
        }
        ParsedCommand::RenameBoard { old_name, new_name } => {
            item_ops::rename_board(app, &old_name, &new_name)?;
        }
        ParsedCommand::Board => {
            app.clear_board_filter();
            app.set_view(ViewMode::Board)?;
        }
        ParsedCommand::Timeline => {
            app.clear_board_filter();
            app.set_view(ViewMode::Timeline)?;
        }
        ParsedCommand::Archive => {
            app.clear_board_filter();
            app.set_view(ViewMode::Archive)?;
        }
        ParsedCommand::Journal => {
            app.clear_board_filter();
            app.set_view(ViewMode::Journal)?;
        }
        ParsedCommand::Sort => {
            app.cycle_sort_method();
            app.set_status(
                format!("Sort: {}", app.sort_method.display_name()),
                StatusKind::Info,
            );
        }
        ParsedCommand::HideDone => {
            app.toggle_hide_completed();
            let msg = if app.filter.hide_completed {
                "Hiding completed tasks"
            } else {
                "Showing completed tasks"
            };
            app.set_status(msg.to_string(), StatusKind::Info);
        }
        ParsedCommand::Sync => {
            app.set_status("Syncing...".to_string(), StatusKind::Info);
            app.refresh_items()?;
            app.set_status("✔ Synced".to_string(), StatusKind::Success);
        }
        ParsedCommand::ForceSync => {
            app.set_status("Force syncing...".to_string(), StatusKind::Info);
            app.items.clear();
            app.refresh_items()?;
            let count = app.items.len();
            app.set_status(
                format!("✔ Force synced ({count} items)"),
                StatusKind::Success,
            );
        }
        ParsedCommand::Ping => {
            let config = crate::config::Config::load_or_default();
            if !config.sync.enabled {
                app.set_status(
                    "✗ Sync not enabled (local mode)".to_string(),
                    StatusKind::Error,
                );
            } else {
                let url = config.sync.server_url.clone();
                let start = std::time::Instant::now();
                match reqwest::blocking::Client::new()
                    .get(format!("{}/health", url))
                    .timeout(std::time::Duration::from_secs(5))
                    .send()
                {
                    Ok(resp) if resp.status().is_success() => {
                        let ms = start.elapsed().as_millis();
                        app.set_status(
                            format!("✔ Server reachable ({ms}ms) — {url}"),
                            StatusKind::Success,
                        );
                    }
                    Ok(resp) => {
                        let ms = start.elapsed().as_millis();
                        app.set_status(
                            format!("⚠ Server responded {} ({ms}ms) — {url}", resp.status()),
                            StatusKind::Error,
                        );
                    }
                    Err(e) => {
                        app.set_status(format!("✗ Server unreachable — {e}"), StatusKind::Error);
                    }
                }
            }
        }
        ParsedCommand::Server => {
            let config = crate::config::Config::load_or_default();
            let mode = if config.sync.enabled {
                "remote"
            } else {
                "local"
            };
            let mut parts = vec![format!("Mode: {mode}")];
            if config.sync.enabled {
                parts.push(format!("Server: {}", config.sync.server_url));
            }
            if let Ok(Some(creds)) = crate::credentials::Credentials::load() {
                parts.push(format!(
                    "Encryption: {}",
                    if creds.encryption_key.is_empty() {
                        "not set"
                    } else {
                        "configured"
                    }
                ));
                parts.push(format!(
                    "Session: {}",
                    if creds.token.is_empty() {
                        "no token"
                    } else {
                        "active"
                    }
                ));
            }
            app.set_status(parts.join(" │ "), StatusKind::Info);
        }
        ParsedCommand::EncryptionKey { sub } => {
            handle_encryption_key(app, sub)?;
        }
        ParsedCommand::Reset { target } => {
            let msg = match target.as_str() {
                "credentials" => "Delete saved credentials (token + encryption key)?",
                "data" => "Clear all local cached data?",
                "all" => "Reset ALL local data and credentials?",
                _ => unreachable!(),
            };
            app.command_line.pending_confirm = Some(PendingAction::Reset {
                target: target.clone(),
            });
            app.set_status(msg.to_string(), StatusKind::Info);
        }
        ParsedCommand::Status => {
            let config = crate::config::Config::load_or_default();
            let mode = if config.sync.enabled {
                "remote"
            } else {
                "local"
            };
            let server = if config.sync.enabled {
                format!(" ({})", config.sync.server_url)
            } else {
                String::new()
            };
            app.set_status(format!("Mode: {mode}{server}"), StatusKind::Info);
        }
        ParsedCommand::Help => {
            app.popup = Some(PopupState::Help { scroll: 0 });
        }
        ParsedCommand::Quit => {
            app.quit();
        }
    }
    Ok(())
}

/// Handle the /encryption-key command and its subcommands.
fn handle_encryption_key(app: &mut App, sub: Option<String>) -> Result<()> {
    if let Some(sub) = sub {
        if let Some(key) = sub.strip_prefix("set ").map(str::trim) {
            if key.is_empty() {
                app.set_status(
                    "Usage: /encryption-key set <base64-key>".to_string(),
                    StatusKind::Error,
                );
            } else {
                use base64::Engine;
                match base64::engine::general_purpose::STANDARD.decode(key) {
                    Ok(bytes) if bytes.len() == 32 => {
                        if let Ok(Some(mut creds)) = crate::credentials::Credentials::load() {
                            creds.encryption_key = key.to_string();
                            if creds.save().is_ok() {
                                app.set_status(
                                    "✔ Encryption key updated".to_string(),
                                    StatusKind::Success,
                                );
                            } else {
                                app.set_status(
                                    "✗ Failed to save credentials".to_string(),
                                    StatusKind::Error,
                                );
                            }
                        } else {
                            app.set_status(
                                "✗ No credentials file found".to_string(),
                                StatusKind::Error,
                            );
                        }
                    }
                    Ok(bytes) => {
                        app.set_status(
                            format!("✗ Key must be 32 bytes (got {} bytes)", bytes.len()),
                            StatusKind::Error,
                        );
                    }
                    Err(_) => {
                        app.set_status(
                            "✗ Invalid base64 encoding".to_string(),
                            StatusKind::Error,
                        );
                    }
                }
            }
        } else {
            app.set_status(
                "Usage: /encryption-key [set <base64-key>]".to_string(),
                StatusKind::Error,
            );
        }
    } else {
        // Show current encryption key status
        if let Ok(Some(creds)) = crate::credentials::Credentials::load() {
            if !creds.encryption_key.is_empty() {
                use base64::Engine;
                let hash = if let Ok(bytes) =
                    base64::engine::general_purpose::STANDARD.decode(&creds.encryption_key)
                {
                    format!("{:x}{:x}{:x}...", bytes[0], bytes[1], bytes[2])
                } else {
                    "invalid".to_string()
                };
                app.set_status(
                    format!("Encryption key: configured (hash: {hash})"),
                    StatusKind::Info,
                );
            } else {
                app.set_status("Encryption key: not set".to_string(), StatusKind::Info);
            }
        } else {
            app.set_status("No credentials found".to_string(), StatusKind::Error);
        }
    }
    Ok(())
}
