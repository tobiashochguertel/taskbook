use ratatui::{
    layout::Rect,
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Clear, Paragraph},
    Frame,
};

use crate::tui::app::{App, PendingAction, SuggestionKind};
use crate::tui::autocomplete::COMMANDS;
use crate::tui::command_parser;

/// Render the command line at the bottom of the screen
pub fn render_command_line(frame: &mut Frame, app: &App, area: Rect) {
    // Pending confirmation takes over the command line
    if let Some(ref action) = app.command_line.pending_confirm {
        render_confirm(frame, app, area, action);
        return;
    }

    if app.command_line.focused {
        render_input(frame, app, area);
    } else {
        render_placeholder(frame, app, area);
    }
}

/// Render the unfocused command line with placeholder text
fn render_placeholder(frame: &mut Frame, _app: &App, area: Rect) {
    let prompt_style = Style::default().fg(Color::Rgb(80, 80, 100));
    let placeholder_style = Style::default().fg(Color::Rgb(100, 100, 120));

    let line = Line::from(vec![
        Span::styled("  > ", prompt_style),
        Span::styled("Type / or Tab for commands, ? for help", placeholder_style),
    ]);

    frame.render_widget(Paragraph::new(line), area);
}

/// Render the active input line
fn render_input(frame: &mut Frame, app: &App, area: Rect) {
    let input = &app.command_line.input;
    let cursor = app.command_line.cursor;
    let input_chars: Vec<char> = input.chars().collect();
    let char_count = input_chars.len();

    // Calculate visible window
    let usable_width = area.width.saturating_sub(4) as usize; // "  > " prefix
    let (display_start, display_end, cursor_in_display) = if char_count > usable_width {
        let start = cursor.saturating_sub(usable_width / 2);
        let end = (start + usable_width).min(char_count);
        let adjusted_start = if end == char_count {
            end.saturating_sub(usable_width)
        } else {
            start
        };
        (adjusted_start, end, cursor - adjusted_start)
    } else {
        (0, char_count, cursor)
    };

    let display_chars: String = input_chars[display_start..display_end].iter().collect();
    let cursor_pos = cursor_in_display.min(display_end - display_start);

    let before: String = display_chars.chars().take(cursor_pos).collect();
    let after_chars: Vec<char> = display_chars.chars().skip(cursor_pos).collect();
    let cursor_char = after_chars.first().copied().unwrap_or(' ');
    let after: String = after_chars.iter().skip(1).collect();

    let cursor_style = Style::default().bg(Color::White).fg(Color::Black);
    let prompt_style = app.theme.info.add_modifier(Modifier::BOLD);
    let ghost_style = Style::default().fg(Color::Rgb(80, 80, 100));

    // Syntax highlighting: color the input based on command validity
    let input_style = get_input_validation_style(input);

    // Generate ghost text hint for recognized commands
    let ghost_text = get_ghost_text(input);

    let mut spans = vec![
        Span::styled("  > ", prompt_style),
        Span::styled(before, input_style),
        Span::styled(cursor_char.to_string(), cursor_style),
        Span::styled(after, input_style),
    ];

    // Show ghost text after user input if there's space
    if let Some(ref ghost) = ghost_text {
        if cursor == char_count && app.command_line.suggestions.is_empty() {
            spans.push(Span::styled(ghost.as_str(), ghost_style));
        }
    }

    let line = Line::from(spans);

    frame.render_widget(Paragraph::new(line), area);
}

/// Render inline confirmation prompt
fn render_confirm(frame: &mut Frame, app: &App, area: Rect, action: &PendingAction) {
    let message = match action {
        PendingAction::Delete { ids } => {
            if ids.len() == 1 {
                format!("Delete item {}?", ids[0])
            } else {
                format!("Delete {} items?", ids.len())
            }
        }
        PendingAction::Clear => "Clear all completed tasks?".to_string(),
        PendingAction::Reset { target } => {
            format!(
                "Reset {}?",
                match target.as_str() {
                    "credentials" => "saved credentials",
                    "data" => "all local data",
                    "all" => "ALL data and credentials",
                    _ => &target,
                }
            )
        }
    };

    let bold = Style::default().add_modifier(Modifier::BOLD);

    let line = Line::from(vec![
        Span::raw("  "),
        Span::styled(&message, app.theme.warning),
        Span::raw("  "),
        Span::styled("[Enter]", bold),
        Span::raw(" Confirm  "),
        Span::styled("[Esc]", bold),
        Span::raw(" Cancel"),
    ]);

    frame.render_widget(Paragraph::new(line), area);
}

/// Render autocomplete dropdown floating above the command line
pub fn render_autocomplete(frame: &mut Frame, app: &App, content_area: Rect) {
    if app.command_line.suggestions.is_empty() || !app.command_line.focused {
        return;
    }

    let suggestions = &app.command_line.suggestions;
    let count = suggestions.len().min(8) as u16;

    // Position: bottom of content area, left-aligned with command line prompt
    let dropdown_height = count;
    let dropdown_y = content_area.y + content_area.height.saturating_sub(dropdown_height);
    let dropdown_x = content_area.x + 2; // align with prompt
    let dropdown_width = content_area.width.saturating_sub(4).min(50);

    let dropdown_area = Rect::new(dropdown_x, dropdown_y, dropdown_width, dropdown_height);

    // Clear the area behind the dropdown
    frame.render_widget(Clear, dropdown_area);

    let autocomplete_bg = Style::default().bg(Color::Rgb(40, 40, 55));
    let autocomplete_selected = Style::default()
        .bg(Color::Rgb(60, 60, 90))
        .add_modifier(Modifier::BOLD);
    let autocomplete_hint = Style::default()
        .fg(Color::Rgb(120, 120, 140))
        .bg(Color::Rgb(40, 40, 55));
    let autocomplete_hint_selected = Style::default()
        .fg(Color::Rgb(150, 150, 170))
        .bg(Color::Rgb(60, 60, 90));

    let selected = app.command_line.selected_suggestion;

    let mut lines: Vec<Line> = Vec::new();
    for (i, suggestion) in suggestions.iter().enumerate().take(count as usize) {
        let is_selected = selected == Some(i);
        let base_style = if is_selected {
            autocomplete_selected
        } else {
            autocomplete_bg
        };
        let hint_style = if is_selected {
            autocomplete_hint_selected
        } else {
            autocomplete_hint
        };

        let icon = match suggestion.kind {
            SuggestionKind::Command => "/",
            SuggestionKind::Board => "@",
            SuggestionKind::Item => "·",
        };

        let mut spans = vec![
            Span::styled(format!(" {} ", icon), hint_style),
            Span::styled(&suggestion.display, base_style),
        ];

        if let Some(ref desc) = suggestion.description {
            // Pad to align descriptions
            let name_len = suggestion.display.len() + 3; // icon + spaces
            let padding = dropdown_width as usize - name_len.min(dropdown_width as usize);
            let desc_max = padding.saturating_sub(2);
            if desc_max > 0 {
                let truncated: String = desc.chars().take(desc_max).collect();
                let pad_amount =
                    (dropdown_width as usize).saturating_sub(name_len + truncated.len() + 1);
                spans.push(Span::styled(" ".repeat(pad_amount), base_style));
                spans.push(Span::styled(truncated, hint_style));
            }
        }

        // Fill remaining width with background (use display width, not byte length)
        let line_len: usize = spans
            .iter()
            .map(|s| unicode_width::UnicodeWidthStr::width(s.content.as_ref()))
            .sum();
        if line_len < dropdown_width as usize {
            spans.push(Span::styled(
                " ".repeat(dropdown_width as usize - line_len),
                base_style,
            ));
        }

        lines.push(Line::from(spans));
    }

    let paragraph = Paragraph::new(lines);
    frame.render_widget(paragraph, dropdown_area);
}

/// Get ghost text hint for a slash command based on current input.
///
/// Dynamically adjusts to show the *next* expected argument, not the full
/// syntax.  This gives the user incremental guidance as they type.
fn get_ghost_text(input: &str) -> Option<String> {
    if !input.starts_with('/') {
        return None;
    }

    let parts: Vec<&str> = input.splitn(2, ' ').collect();
    let cmd = parts[0][1..].to_lowercase();
    let args_str = if parts.len() > 1 { parts[1] } else { "" };
    let args: Vec<&str> = args_str.split_whitespace().collect();
    let trailing_space = args_str.ends_with(' ') || args_str.is_empty();
    // Effective arg count: how many complete arguments we have
    let arg_count = if trailing_space {
        args.len()
    } else {
        args.len().saturating_sub(1)
    };

    match cmd.as_str() {
        "task" | "note" => match arg_count {
            0 if parts.len() == 1 => Some(" @board description +tag".into()),
            0 => Some("@board description +tag".into()),
            _ => None,
        },
        "edit" => match arg_count {
            0 if parts.len() == 1 => Some(" @<id> new description".into()),
            0 => Some("@<id> new description".into()),
            1 => Some("new description".into()),
            _ => None,
        },
        "move" => match arg_count {
            0 if parts.len() == 1 => Some(" @<id> @board".into()),
            0 => Some("@<id> @board".into()),
            1 => Some("@board".into()),
            _ => None,
        },
        "delete" | "check" | "star" | "begin" => match arg_count {
            0 if parts.len() == 1 => Some(" @<id> [@<id>...]".into()),
            0 => Some("@<id> [@<id>...]".into()),
            _ => Some("[@<id>...]".into()),
        },
        "search" => {
            if parts.len() == 1 {
                Some(" <term>".into())
            } else if arg_count == 0 {
                Some("<term>".into())
            } else {
                None
            }
        }
        "priority" => match arg_count {
            0 if parts.len() == 1 => Some(" @<id> 1-3".into()),
            0 => Some("@<id> 1-3".into()),
            1 => Some("1-3".into()),
            _ => None,
        },
        "tag" => match arg_count {
            0 if parts.len() == 1 => Some(" @<id> +add -remove".into()),
            0 => Some("@<id> +add -remove".into()),
            1 => Some("+add -remove".into()),
            _ => Some("+add -remove".into()),
        },
        "rename-board" => match arg_count {
            0 if parts.len() == 1 => Some(" @\"old\" @\"new\"".into()),
            0 => Some("@\"old\" @\"new\"".into()),
            1 => Some("@\"new\"".into()),
            _ => None,
        },
        "encryption-key" => {
            if parts.len() == 1 {
                Some(" [set <base64-key>]".into())
            } else if arg_count == 0 {
                Some("[set <base64-key>]".into())
            } else {
                None
            }
        }
        "reset" => {
            if parts.len() == 1 {
                Some(" credentials|data|all".into())
            } else if arg_count == 0 {
                Some("credentials|data|all".into())
            } else {
                None
            }
        }
        _ => None,
    }
}

/// Determine the input text color based on command validity.
///
/// - White (default): not a slash command yet (plain text input)
/// - Green: the input parses as a complete, valid command
/// - Yellow: the input is a recognized command prefix but incomplete
/// - Red: the command name is invalid or arguments are malformed
fn get_input_validation_style(input: &str) -> Style {
    let trimmed = input.trim();
    if !trimmed.starts_with('/') {
        return Style::default();
    }

    // Extract the command name
    let parts: Vec<&str> = trimmed[1..].splitn(2, ' ').collect();
    let cmd = parts[0].to_lowercase();

    if cmd.is_empty() {
        // Just typed "/" — neutral
        return Style::default();
    }

    // Check if it's a recognized command name (exact or prefix)
    let exact_match = COMMANDS.iter().any(|(name, _)| *name == cmd);
    let prefix_match = COMMANDS.iter().any(|(name, _)| name.starts_with(&cmd));

    if !exact_match && !prefix_match {
        // Unknown command name — red
        return Style::default().fg(Color::Rgb(255, 100, 100));
    }

    if !exact_match && prefix_match {
        // Partial command name being typed — yellow/amber
        return Style::default().fg(Color::Rgb(255, 200, 80));
    }

    // Exact command match — try full parse to see if arguments are valid
    match command_parser::parse_command(trimmed) {
        Ok(_) => Style::default().fg(Color::Rgb(100, 255, 100)), // valid — green
        Err(_) => {
            // Command is recognized but arguments are incomplete/wrong
            if parts.len() == 1 || parts.get(1).map_or(true, |a| a.trim().is_empty()) {
                // No arguments yet — just the command name, show as yellow (incomplete)
                Style::default().fg(Color::Rgb(255, 200, 80))
            } else {
                // Has arguments but they're wrong — red
                Style::default().fg(Color::Rgb(255, 100, 100))
            }
        }
    }
}
