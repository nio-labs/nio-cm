use std::path::PathBuf;

pub fn find_nio_binary() -> Option<PathBuf> {
    let is_win = cfg!(windows);
    let ext = if is_win { ".exe" } else { "" };
    let nio_cmd = format!("nio{}", ext);

    // 1. Check system PATH
    if let Ok(path) = std::env::var("PATH") {
        for dir in std::env::split_paths(&path) {
            let candidate = dir.join(&nio_cmd);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    // 2. Check canonical install locations
    let home_dir = if is_win {
        std::env::var("USERPROFILE").ok()
    } else {
        std::env::var("HOME").ok()
    };

    if let Some(home_str) = home_dir {
        let home = PathBuf::from(home_str);
        let candidates = [
            home.join(".nio").join("bin").join(&nio_cmd),
            home.join(".local").join("bin").join(&nio_cmd),
            home.join(".cargo").join("bin").join(&nio_cmd),
        ];

        for c in candidates {
            if c.is_file() {
                return Some(c);
            }
        }
    }

    None
}

pub async fn ensure_nio_binary() -> Option<PathBuf> {
    if let Some(bin) = find_nio_binary() {
        return Some(bin);
    }

    println!("[nio-cm] NioAI agent (nio) not found. Automatically bundling @nio-labs/nio-ai...");

    // Attempt A: via npx / npm
    if let Ok(path_env) = std::env::var("PATH") {
        let npx_cmd = if cfg!(windows) { "npx.cmd" } else { "npx" };
        let mut npx_path = None;
        for dir in std::env::split_paths(&path_env) {
            let candidate = dir.join(npx_cmd);
            if candidate.is_file() {
                npx_path = Some(candidate);
                break;
            }
        }

        if let Some(npx) = npx_path {
            println!("[nio-cm] Fetching @nio-labs/nio-ai via npm...");
            let result = tokio::process::Command::new(npx)
                .args(["-y", "@nio-labs/nio-ai", "--version"])
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .status()
                .await;

            if let Ok(status) = result {
                if status.success() {
                    if let Some(bin) = find_nio_binary() {
                        return Some(bin);
                    }
                }
            }
        }
    }

    // Attempt B: direct native curl/powershell fallback
    println!("[nio-cm] Installing nio via official installer...");
    if cfg!(windows) {
        let _ = tokio::process::Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "irm https://raw.githubusercontent.com/nio-labs/nio/main/install.ps1 | iex",
            ])
            .status()
            .await;
    } else {
        let _ = tokio::process::Command::new("sh")
            .args([
                "-c",
                "curl -fsSL https://raw.githubusercontent.com/nio-labs/nio/main/install.sh | bash",
            ])
            .status()
            .await;
    }

    if let Some(bin) = find_nio_binary() {
        return Some(bin);
    }

    eprintln!("[nio-cm] Warning: Could not automatically bundle @nio-labs/nio-ai");
    eprintln!("[nio-cm] You can install it manually with: npx @nio-labs/nio-ai");

    None
}
