// Prevents an extra console window on Windows in release builds. DO NOT REMOVE.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::Write;
use std::net::{SocketAddr, TcpStream};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{Manager, RunEvent};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

const DAEMON_PORT: u16 = 1422;

/// Holds the sidecar process only when this app instance spawned it.
/// A daemon that was already running (e.g. the standalone PWA server) is left untouched.
struct DaemonChild(Mutex<Option<tauri_plugin_shell::process::CommandChild>>);

fn daemon_addr() -> SocketAddr {
    SocketAddr::from(([127, 0, 0, 1], DAEMON_PORT))
}

fn daemon_running() -> bool {
    TcpStream::connect_timeout(&daemon_addr(), Duration::from_millis(400)).is_ok()
}

/// Asks the daemon to reap every PTY session and exit. Falls back to a hard
/// kill if the daemon does not respond in time.
fn request_shutdown() {
    if let Ok(mut stream) = TcpStream::connect_timeout(&daemon_addr(), Duration::from_millis(400)) {
        let _ = stream.write_all(
            b"POST /shutdown HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
        );
    }
}

/// GUI-launched apps get a stripped PATH, which hides the `nio` CLI and the
/// user's shell tooling. Re-append the usual locations for spawned PTY sessions.
fn augmented_path() -> String {
    let sep = if cfg!(windows) { ';' } else { ':' };
    let mut extra: Vec<std::path::PathBuf> = Vec::new();

    if let Ok(home) = std::env::var(if cfg!(windows) { "USERPROFILE" } else { "HOME" }) {
        let home = std::path::PathBuf::from(home);
        extra.push(home.join(".nio").join("bin"));
        extra.push(home.join(".local").join("bin"));
        extra.push(home.join(".cargo").join("bin"));
    }
    if cfg!(unix) {
        extra.push(std::path::PathBuf::from("/usr/local/bin"));
        extra.push(std::path::PathBuf::from("/opt/homebrew/bin"));
    }

    let mut path = std::env::var("PATH").unwrap_or_default();
    for dir in extra {
        let rendered = dir.to_string_lossy().to_string();
        if dir.is_dir() && !path.split(sep).any(|existing| existing == rendered) {
            path.push(sep);
            path.push_str(&rendered);
        }
    }
    path
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle().clone();

            // Attach to an already-running daemon instead of starting a second one
            // (a second instance could not bind port 1422 anyway).
            if daemon_running() {
                println!("[niocm] daemon already running on :{DAEMON_PORT}, attaching");
                return Ok(());
            }

            let path = augmented_path();
            let port = DAEMON_PORT.to_string();
            let command = handle.shell().sidecar("niocm")?.envs([
                // The daemon defaults to 0.0.0.0 for hosted deployments; the
                // desktop app must never expose PTY access to the network.
                ("HOST", "127.0.0.1"),
                ("PORT", port.as_str()),
                ("PATH", path.as_str()),
            ]);

            let (mut rx, child) = command.spawn()?;
            app.manage(DaemonChild(Mutex::new(Some(child))));

            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            println!("[niocm] {}", String::from_utf8_lossy(&line).trim_end())
                        }
                        CommandEvent::Stderr(line) => {
                            eprintln!("[niocm] {}", String::from_utf8_lossy(&line).trim_end())
                        }
                        CommandEvent::Terminated(payload) => {
                            eprintln!("[niocm] daemon exited (code: {:?})", payload.code)
                        }
                        CommandEvent::Error(err) => eprintln!("[niocm] daemon error: {err}"),
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building NioCM desktop app")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                let spawned = app_handle
                    .try_state::<DaemonChild>()
                    .map(|state| state.0.lock().unwrap().is_some())
                    .unwrap_or(false);
                if !spawned {
                    return;
                }
                request_shutdown();
                std::thread::sleep(Duration::from_millis(300));
                if let Some(state) = app_handle.try_state::<DaemonChild>() {
                    if let Some(child) = state.0.lock().unwrap().take() {
                        let _ = child.kill();
                    }
                }
            }
        });
}
