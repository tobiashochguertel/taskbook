use std::process::Command;

fn main() {
    // Cargo version
    println!(
        "cargo:rustc-env=TB_PKG_VERSION={}",
        env!("CARGO_PKG_VERSION")
    );

    // Git information
    let git_hash = run_git(&["rev-parse", "--short", "HEAD"]);
    let git_branch = run_git(&["rev-parse", "--abbrev-ref", "HEAD"]);
    let git_tag = run_git(&["describe", "--tags", "--abbrev=0"]).unwrap_or_default();
    let git_dirty = run_git(&["status", "--porcelain"])
        .map(|s| if s.is_empty() { "" } else { "-dirty" })
        .unwrap_or("");

    // Repository remote URL
    let git_repo = run_git(&["remote", "get-url", "origin"]).unwrap_or_default();

    // Build timestamp
    let build_date = chrono_free_timestamp();

    println!(
        "cargo:rustc-env=TB_GIT_HASH={}",
        git_hash.as_deref().unwrap_or("unknown")
    );
    println!(
        "cargo:rustc-env=TB_GIT_BRANCH={}",
        git_branch.as_deref().unwrap_or("unknown")
    );
    println!("cargo:rustc-env=TB_GIT_TAG={}", git_tag);
    println!("cargo:rustc-env=TB_GIT_DIRTY={}", git_dirty);
    println!("cargo:rustc-env=TB_GIT_REPO={}", git_repo);
    println!("cargo:rustc-env=TB_BUILD_DATE={}", build_date);

    // Re-run if git HEAD changes
    println!("cargo:rerun-if-changed=../../.git/HEAD");
    println!("cargo:rerun-if-changed=../../.git/refs/");
}

fn run_git(args: &[&str]) -> Option<String> {
    Command::new("git")
        .args(args)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}

fn chrono_free_timestamp() -> String {
    // Use the `date` command for a build timestamp without adding a dependency
    Command::new("date")
        .args(["-u", "+%Y-%m-%d %H:%M:%S UTC"])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}
