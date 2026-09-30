use std::path::PathBuf;

use base64::Engine;
use colored::Colorize;

use crate::api_client::{ApiClient, EncryptedItemData};
use crate::config::Config;
use crate::credentials::Credentials;
use crate::directory::resolve_taskbook_directory;
use crate::error::{Result, TaskbookError};
use crate::render::Render;
use crate::storage::{LocalStorage, StorageBackend};
use crate::taskbook::{EditorResult, Taskbook};
use taskbook_common::board;
use taskbook_common::encryption::encrypt_item;

/// Parse a single @id target from CLI input. Returns (id, target_string).
fn parse_single_id(input: &[String], render: &Render) -> Result<(u64, String)> {
    let targets: Vec<&String> = input.iter().filter(|x| x.starts_with('@')).collect();

    if targets.is_empty() {
        render.missing_id();
        return Err(TaskbookError::InvalidId(0));
    }

    if targets.len() > 1 {
        render.invalid_ids_number();
        return Err(TaskbookError::InvalidId(0));
    }

    let target = targets[0].clone();
    let id_str = target.trim_start_matches('@');
    let id: u64 = id_str.parse().map_err(|_| TaskbookError::InvalidId(0))?;
    Ok((id, target))
}

/// Execute CLI commands
#[allow(clippy::too_many_arguments)]
pub fn run(
    input: Vec<String>,
    archive: bool,
    task: bool,
    restore: bool,
    note: bool,
    delete: bool,
    check: bool,
    begin: bool,
    star: bool,
    priority: bool,
    copy: bool,
    timeline: bool,
    find: bool,
    list: bool,
    edit: bool,
    edit_note: bool,
    r#move: bool,
    clear: bool,
    tag: bool,
    taskbook_dir: Option<PathBuf>,
) -> Result<()> {
    let taskbook = Taskbook::new(taskbook_dir.as_deref())?;
    let config = Config::load_or_default();
    let render = Render::new(config);

    if archive {
        let data = taskbook.get_all_archive_items()?;
        let grouped = taskbook.group_by_date(&data);
        render.display_by_date(&grouped);
        return Ok(());
    }

    if task {
        if input.is_empty() {
            render.missing_desc();
            return Err(TaskbookError::InvalidId(0));
        }
        let (boards, description, priority, tags) = board::parse_cli_input(&input);
        if description.is_empty() {
            render.missing_desc();
            return Err(TaskbookError::InvalidId(0));
        }
        let id = taskbook.create_task(boards, description, priority, tags)?;
        render.success_create(id, true);
        return Ok(());
    }

    if restore {
        let ids: Vec<u64> = input.iter().filter_map(|s| s.parse().ok()).collect();
        let restored = taskbook.restore_items_silent(&ids)?;
        render.success_restore(&restored);
        return Ok(());
    }

    if note {
        if input.is_empty() {
            match taskbook.create_note_with_editor()? {
                EditorResult::Created(id) => render.success_create(id, false),
                EditorResult::Cancelled => render.note_cancelled(),
                EditorResult::Edited(_) => {}
            }
            return Ok(());
        }
        let (boards, description, _priority, tags) = board::parse_cli_input(&input);
        if description.is_empty() {
            render.missing_desc();
            return Err(TaskbookError::InvalidId(0));
        }
        let id = taskbook.create_note(boards, description, tags)?;
        render.success_create(id, false);
        return Ok(());
    }

    if edit_note {
        let (id, _) = parse_single_id(&input, &render)?;
        match taskbook.edit_note_in_editor(id)? {
            EditorResult::Edited(id) => render.success_edit(id),
            EditorResult::Cancelled => render.note_cancelled(),
            EditorResult::Created(_) => {}
        }
        return Ok(());
    }

    if delete {
        let ids: Vec<u64> = input.iter().filter_map(|s| s.parse().ok()).collect();
        let deleted = taskbook.delete_items_silent(&ids)?;
        render.success_delete(&deleted);
        return Ok(());
    }

    if check {
        let ids: Vec<u64> = input.iter().filter_map(|s| s.parse().ok()).collect();
        let result = taskbook.check_tasks(&ids)?;
        render.mark_complete(&result.on);
        render.mark_incomplete(&result.off);
        return Ok(());
    }

    if begin {
        let ids: Vec<u64> = input.iter().filter_map(|s| s.parse().ok()).collect();
        let result = taskbook.begin_tasks(&ids)?;
        render.mark_started(&result.on);
        render.mark_paused(&result.off);
        return Ok(());
    }

    if star {
        let ids: Vec<u64> = input.iter().filter_map(|s| s.parse().ok()).collect();
        let result = taskbook.star_items(&ids)?;
        render.mark_starred(&result.on);
        render.mark_unstarred(&result.off);
        return Ok(());
    }

    if priority {
        let level = input
            .iter()
            .find(|x| matches!(x.as_str(), "1" | "2" | "3"))
            .and_then(|s| s.parse::<u8>().ok());

        let level = match level {
            Some(l) => l,
            None => {
                render.invalid_priority();
                return Err(TaskbookError::InvalidId(0));
            }
        };

        let (id, _) = parse_single_id(&input, &render)?;
        taskbook.update_priority_silent(id, level)?;
        render.success_priority(id, level);
        return Ok(());
    }

    if copy {
        let ids: Vec<u64> = input.iter().filter_map(|s| s.parse().ok()).collect();
        let copied = taskbook.copy_to_clipboard(&ids)?;
        render.success_copy_to_clipboard(&copied);
        return Ok(());
    }

    if timeline {
        let data = taskbook.get_all_items()?;
        let grouped = taskbook.group_by_date(&data);
        render.display_by_date(&grouped);
        let stats = taskbook.get_stats(&data);
        render.display_stats(&stats);
        return Ok(());
    }

    if find {
        let result = taskbook.find_items(&input)?;
        let boards = taskbook.get_boards(&result);
        let grouped = taskbook.group_by_board(&result, &boards);
        render.display_by_board(&grouped);
        return Ok(());
    }

    if list {
        let (filtered_data, display_boards) = taskbook.list_by_attributes(&input)?;
        let grouped = taskbook.group_by_board(&filtered_data, &display_boards);
        render.display_by_board(&grouped);
        let stats = taskbook.get_stats(&filtered_data);
        render.display_stats(&stats);
        return Ok(());
    }

    if edit {
        let (id, target) = parse_single_id(&input, &render)?;
        let new_desc: String = input
            .iter()
            .filter(|x| *x != &target)
            .cloned()
            .collect::<Vec<_>>()
            .join(" ");

        if new_desc.is_empty() {
            render.missing_desc();
            return Err(TaskbookError::InvalidId(0));
        }

        taskbook.edit_description_silent(id, &new_desc)?;
        render.success_edit(id);
        return Ok(());
    }

    if r#move {
        let (id, target) = parse_single_id(&input, &render)?;
        let mut boards: Vec<String> = Vec::new();
        for word in &input {
            if *word != target {
                let normalized = board::normalize_board_name(word);
                if !boards.iter().any(|b| board::board_eq(b, &normalized)) {
                    boards.push(normalized);
                }
            }
        }

        if boards.is_empty() {
            render.missing_boards();
            return Err(TaskbookError::InvalidId(0));
        }

        let display_boards: Vec<String> = boards.iter().map(|b| board::display_name(b)).collect();
        taskbook.move_boards_silent(id, boards)?;
        render.success_move(id, &display_boards);
        return Ok(());
    }

    if clear {
        let cleared = taskbook.clear_silent()?;
        render.success_clear(&cleared);
        return Ok(());
    }

    if tag {
        let (id, target) = parse_single_id(&input, &render)?;

        let mut add_tags: Vec<String> = Vec::new();
        let mut remove_tags: Vec<String> = Vec::new();

        for word in &input {
            if *word == target {
                continue;
            }
            if let Some(tag_name) = word.strip_prefix('+') {
                let normalized = board::normalize_tag(&format!("+{}", tag_name));
                if !normalized.is_empty() {
                    add_tags.push(normalized);
                }
            } else if let Some(tag_name) = word.strip_prefix('-') {
                let normalized = tag_name.trim().to_lowercase();
                if !normalized.is_empty() {
                    remove_tags.push(normalized);
                }
            }
        }

        if add_tags.is_empty() && remove_tags.is_empty() {
            render.missing_tags();
            return Err(TaskbookError::General("No tags provided".to_string()));
        }

        taskbook.update_tags_silent(id, &add_tags, &remove_tags)?;
        render.success_tag(id, &add_tags, &remove_tags);
        return Ok(());
    }

    // Default: display board view and stats
    let data = taskbook.get_all_items()?;
    let boards = taskbook.get_boards(&data);
    let grouped = taskbook.group_by_board(&data, &boards);
    render.display_by_board(&grouped);
    let stats = taskbook.get_stats(&data);
    render.display_stats(&stats);
    Ok(())
}

/// Migrate local data to the remote server.
pub fn migrate(taskbook_dir: Option<PathBuf>) -> Result<()> {
    let creds = Credentials::load()?.ok_or_else(|| {
        TaskbookError::Auth("not logged in — run `tb register` or `tb login` first".to_string())
    })?;

    let config = Config::load_or_default();
    let encryption_key = creds.encryption_key_bytes()?;
    let engine = base64::engine::general_purpose::STANDARD;

    // Load local data
    let resolved_dir = resolve_taskbook_directory(taskbook_dir.as_deref())?;
    let local = LocalStorage::new(&resolved_dir)?;

    let items = local.get()?;
    let archive = local.get_archive()?;

    // Encrypt and upload items
    let client = ApiClient::new(&config.sync.server_url, Some(&creds.token));

    let mut encrypted_items = std::collections::HashMap::new();
    for (key, item) in &items {
        let encrypted = encrypt_item(&encryption_key, item)
            .map_err(|e| TaskbookError::General(format!("encryption failed: {e}")))?;
        encrypted_items.insert(
            key.clone(),
            EncryptedItemData {
                data: engine.encode(&encrypted.data),
                nonce: engine.encode(&encrypted.nonce),
            },
        );
    }
    client.put_items(&encrypted_items)?;

    let mut encrypted_archive = std::collections::HashMap::new();
    for (key, item) in &archive {
        let encrypted = encrypt_item(&encryption_key, item)
            .map_err(|e| TaskbookError::General(format!("encryption failed: {e}")))?;
        encrypted_archive.insert(
            key.clone(),
            EncryptedItemData {
                data: engine.encode(&encrypted.data),
                nonce: engine.encode(&encrypted.nonce),
            },
        );
    }
    client.put_archive(&encrypted_archive)?;

    println!(
        "{}",
        format!(
            "Migrated {} items and {} archived items to server.",
            items.len(),
            archive.len()
        )
        .green()
        .bold()
    );
    println!(
        "{}",
        "To enable sync, set sync.enabled = true in ~/.taskbook.json".dimmed()
    );

    Ok(())
}
