use ratatui::{
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::Paragraph,
    Frame,
};

use ratatui::layout::Rect;

use crate::tui::app::{App, StatusKind, ViewMode};

// ---------------------------------------------------------------------------
// Section background colors (Zellij-inspired)
// ---------------------------------------------------------------------------

/// Dark teal background for sync state section.
const BG_SYNC: Color = Color::Rgb(20, 50, 50);
/// Dark blue background for stats section.
const BG_STATS: Color = Color::Rgb(25, 30, 55);
/// Dark indigo background for view navigation section.
const BG_NAV: Color = Color::Rgb(35, 25, 55);
/// Dark gray background for key hints section.
const BG_KEYS: Color = Color::Rgb(40, 40, 48);

/// Minimum width for count values to avoid layout jumps.
const COUNT_WIDTH: usize = 2;
/// Fixed width for percentage display (always "XXX%").
const PERCENT_WIDTH: usize = 3;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Render the single-line stats/status bar with visually grouped sections.
pub fn render_stats_line(frame: &mut Frame, app: &App, area: Rect) {
    // Status message takes priority (temporary toast)
    if let Some(ref msg) = app.status_message {
        let style = match msg.kind {
            StatusKind::Success => app.theme.success,
            StatusKind::Error => app.theme.error,
            StatusKind::Info => app.theme.info,
        };
        let line = Line::from(vec![Span::raw("  "), Span::styled(&msg.text, style)]);
        frame.render_widget(Paragraph::new(line), area);
        return;
    }

    // Search indicator
    if let Some(ref term) = app.filter.search_term {
        let search_line = Line::from(vec![
            Span::raw("  "),
            Span::styled("Search: ", app.theme.info),
            Span::styled(
                format!("\"{}\"", term),
                app.theme.info.add_modifier(Modifier::BOLD),
            ),
            Span::styled("  (Esc to clear)", app.theme.muted),
        ]);
        frame.render_widget(Paragraph::new(search_line), area);
        return;
    }

    let mut spans: Vec<Span> = Vec::new();

    // ── Section 1: Sync state ────────────────────────────────────────
    if app.config.display_progress_overview {
        build_sync_section(app, &mut spans);
        build_stats_section(app, &mut spans);
    }

    // ── Section 3: View navigation ───────────────────────────────────
    build_nav_section(app, &mut spans);

    // ── Section 4: Key hints ─────────────────────────────────────────
    build_key_hints_section(app, &mut spans);

    let stats_line = Line::from(spans);
    frame.render_widget(Paragraph::new(stats_line), area);
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

/// Section 1: Sync/connection state — teal background.
fn build_sync_section<'a>(app: &'a App, spans: &mut Vec<Span<'a>>) {
    let bg = BG_SYNC;
    if app.config.sync.enabled {
        spans.push(Span::styled(
            " ● Synced ",
            Style::default()
                .fg(Color::Green)
                .bg(bg)
                .add_modifier(Modifier::BOLD),
        ));
    } else {
        spans.push(Span::styled(
            " ● Local ",
            Style::default()
                .fg(Color::DarkGray)
                .bg(bg)
                .add_modifier(Modifier::BOLD),
        ));
    }
    // Separator chevron
    spans.push(Span::styled(" ", Style::default()));
}

/// Section 2: Stats overview — dark blue background with fixed-width numbers.
fn build_stats_section<'a>(app: &'a App, spans: &mut Vec<Span<'a>>) {
    let bg = BG_STATS;
    let stats = app.get_stats();
    let muted = Style::default().fg(Color::Rgb(120, 120, 140)).bg(bg);

    // Percentage — always 3 chars wide (e.g. "  5%", " 33%", "100%")
    spans.push(Span::styled(
        format!(" {:>w$}%", stats.percent, w = PERCENT_WIDTH),
        Style::default()
            .fg(Color::Green)
            .bg(bg)
            .add_modifier(Modifier::BOLD),
    ));
    spans.push(Span::styled(" done", muted));
    spans.push(Span::styled(" │ ", muted));

    // Done count
    push_stat_count(spans, stats.complete, "done", Color::Green, bg);
    spans.push(Span::styled(" · ", muted));

    // In-progress count
    push_stat_count(spans, stats.in_progress, "wip", Color::Yellow, bg);
    spans.push(Span::styled(" · ", muted));

    // Pending count
    push_stat_count(spans, stats.pending, "todo", Color::Rgb(170, 130, 200), bg);
    spans.push(Span::styled(" · ", muted));

    // Notes count
    push_stat_count(spans, stats.notes, "notes", Color::Cyan, bg);

    spans.push(Span::styled(" ", Style::default()));
}

/// Section 3: Active view + navigation keys — indigo background.
fn build_nav_section<'a>(app: &'a App, spans: &mut Vec<Span<'a>>) {
    let bg = BG_NAV;
    let key_style = Style::default()
        .fg(Color::Yellow)
        .bg(bg)
        .add_modifier(Modifier::BOLD);
    let active_style = Style::default()
        .fg(Color::Cyan)
        .bg(bg)
        .add_modifier(Modifier::BOLD | Modifier::UNDERLINED);
    let label = Style::default().fg(Color::Rgb(140, 140, 160)).bg(bg);
    let sep = Style::default().fg(Color::Rgb(80, 80, 100)).bg(bg);

    let views: &[(char, &str, ViewMode)] = &[
        ('1', "Board", ViewMode::Board),
        ('2', "Timeline", ViewMode::Timeline),
        ('3', "Archive", ViewMode::Archive),
        ('4', "Journal", ViewMode::Journal),
    ];

    spans.push(Span::styled(" ", Style::default().bg(bg)));
    for (i, (key, name, mode)) in views.iter().enumerate() {
        let s = if app.view == *mode {
            active_style
        } else {
            key_style
        };
        spans.push(Span::styled(format!("{key}"), s));
        spans.push(Span::styled(format!(" {name}"), label));
        if i < views.len() - 1 {
            spans.push(Span::styled(" │ ", sep));
        }
    }
    spans.push(Span::styled(" ", Style::default().bg(bg)));

    spans.push(Span::styled(" ", Style::default()));
}

/// Section 4: Important key bindings — dark gray background.
fn build_key_hints_section<'a>(app: &'a App, spans: &mut Vec<Span<'a>>) {
    let bg = BG_KEYS;
    let key_style = Style::default()
        .fg(Color::Yellow)
        .bg(bg)
        .add_modifier(Modifier::BOLD);
    let label = Style::default().fg(Color::Rgb(140, 140, 160)).bg(bg);
    let sep = Style::default().fg(Color::Rgb(80, 80, 100)).bg(bg);

    spans.push(Span::styled(" ", Style::default().bg(bg)));

    spans.push(Span::styled("?", key_style));
    spans.push(Span::styled(" Help", label));
    spans.push(Span::styled(" │ ", sep));
    spans.push(Span::styled("/", key_style));
    spans.push(Span::styled(" Cmd", label));
    spans.push(Span::styled(" │ ", sep));

    if app.view == ViewMode::Archive {
        spans.push(Span::styled("r", key_style));
        spans.push(Span::styled(" Restore", label));
    } else {
        spans.push(Span::styled("t", key_style));
        spans.push(Span::styled(" Task", label));
        spans.push(Span::styled(" │ ", sep));
        spans.push(Span::styled("n", key_style));
        spans.push(Span::styled(" Note", label));
    }

    spans.push(Span::styled(" │ ", sep));
    spans.push(Span::styled("q", key_style));
    spans.push(Span::styled(" Quit", label));
    spans.push(Span::styled(" ", Style::default().bg(bg)));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Push a fixed-width stat counter: " NN label".
fn push_stat_count<'a>(
    spans: &mut Vec<Span<'a>>,
    value: usize,
    label: &'a str,
    fg: Color,
    bg: Color,
) {
    spans.push(Span::styled(
        format!("{:>w$}", value, w = COUNT_WIDTH),
        Style::default().fg(fg).bg(bg).add_modifier(Modifier::BOLD),
    ));
    spans.push(Span::styled(
        format!(" {label}"),
        Style::default().fg(Color::Rgb(120, 120, 140)).bg(bg),
    ));
}
