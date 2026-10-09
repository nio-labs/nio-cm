use crate::pty::{PtyManager, SubMsg};
use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};

#[derive(Debug, Deserialize)]
pub struct WsRequest {
    pub id: u64,
    pub command: String,
    pub args: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct WsReply {
    pub id: u64,
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct WsEvent {
    pub event: String,
    pub payload: Value,
}

pub async fn handle_socket(socket: WebSocket, pty_manager: Arc<Mutex<PtyManager>>) {
    let (mut ws_sender, mut ws_receiver) = socket.split();

    // Internal channel for messages destined for the client (replies, events, pty streams)
    let (tx, mut rx) = mpsc::channel::<String>(512);

    // Forwarding task: rx -> ws_sender
    let forward_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_sender.send(Message::Text(msg)).await.is_err() {
                break;
            }
        }
    });

    let client_sessions = Arc::new(Mutex::new(Vec::<String>::new()));

    while let Some(Ok(msg)) = ws_receiver.next().await {
        if let Message::Text(text) = msg {
            let req: Result<WsRequest, _> = serde_json::from_str(&text);
            match req {
                Ok(req) => {
                    let pty_ref = pty_manager.clone();
                    let tx_ref = tx.clone();
                    let sessions_ref = client_sessions.clone();

                    tokio::spawn(async move {
                        let res = handle_command(
                            req.command.as_str(),
                            req.args,
                            pty_ref,
                            tx_ref.clone(),
                            sessions_ref,
                        )
                        .await;
                        let reply = match res {
                            Ok(val) => WsReply {
                                id: req.id,
                                ok: true,
                                result: Some(val),
                                error: None,
                            },
                            Err(err) => WsReply {
                                id: req.id,
                                ok: false,
                                result: None,
                                error: Some(err),
                            },
                        };
                        if let Ok(json_str) = serde_json::to_string(&reply) {
                            let _ = tx_ref.send(json_str).await;
                        }
                    });
                }
                Err(err) => {
                    let err_reply = json!({
                        "id": 0,
                        "ok": false,
                        "error": format!("Invalid JSON request: {}", err)
                    });
                    let _ = tx.send(err_reply.to_string()).await;
                }
            }
        } else if let Message::Close(_) = msg {
            break;
        }
    }

    // Clean up sessions spawned by this connection
    let sessions_to_kill = {
        let s = client_sessions.lock().await;
        s.clone()
    };
    {
        let mut mgr = pty_manager.lock().await;
        for sid in sessions_to_kill {
            let _ = mgr.kill(&sid);
        }
    }

    forward_task.abort();
}

fn process_cwd(pid: u32) -> Option<String> {
    #[cfg(target_os = "linux")]
    {
        std::fs::read_link(format!("/proc/{pid}/cwd"))
            .ok()
            .map(|path| path.to_string_lossy().into_owned())
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = pid;
        None
    }
}

async fn handle_command(
    cmd: &str,
    args: Option<Value>,
    pty_manager: Arc<Mutex<PtyManager>>,
    client_tx: mpsc::Sender<String>,
    client_sessions: Arc<Mutex<Vec<String>>>,
) -> Result<Value, String> {
    let args = args.unwrap_or(Value::Null);

    match cmd {
        "pty_spawn" => {
            let session_id = args["sessionId"]
                .as_str()
                .ok_or("Missing sessionId")?
                .to_string();
            let shell = args["shell"].as_str().map(|s| s.to_string());
            let raw_args = args["args"].as_array().map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect::<Vec<String>>()
            });
            let cwd = args["cwd"].as_str().map(|s| s.to_string());
            let cols = args["cols"].as_u64().unwrap_or(80) as u32;
            let rows = args["rows"].as_u64().unwrap_or(24) as u32;

            let (sub_tx, mut sub_rx) = mpsc::channel::<SubMsg>(128);

            let res = {
                let mut mgr = pty_manager.lock().await;
                mgr.spawn(session_id.clone(), shell, raw_args, cwd, cols, rows)?
            };

            // Attach subscriber
            {
                let mgr = pty_manager.lock().await;
                let _ = mgr.attach(&session_id, sub_tx, 0);
            }

            client_sessions.lock().await.push(session_id.clone());

            // Forward PTY output as events to client
            let sid_clone = session_id.clone();
            let cwd_pid = res.pid;
            let tx_clone = client_tx.clone();
            tokio::spawn(async move {
                let mut cwd_poll = tokio::time::interval(std::time::Duration::from_millis(350));
                cwd_poll.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
                let mut last_cwd = process_cwd(cwd_pid);
                loop {
                    tokio::select! {
                        _ = cwd_poll.tick() => {
                            if let Some(cwd) = process_cwd(cwd_pid) {
                                if last_cwd.as_deref() != Some(cwd.as_str()) {
                                    last_cwd = Some(cwd.clone());
                                    let ev = WsEvent {
                                        event: "pty_cwd".to_string(),
                                        payload: json!({"sessionId": sid_clone, "cwd": cwd}),
                                    };
                                    if let Ok(json_str) = serde_json::to_string(&ev) {
                                        if tx_clone.send(json_str).await.is_err() { break; }
                                    }
                                }
                            }
                        }
                        msg = sub_rx.recv() => {
                            let Some(msg) = msg else { break; };
                            match msg {
                                SubMsg::Out { from, data } => {
                                    let text = String::from_utf8_lossy(&data).to_string();
                                    let ev = WsEvent {
                                        event: "pty_output".to_string(),
                                        payload: json!({
                                            "sessionId": sid_clone,
                                            "from": from,
                                            "data": text
                                        }),
                                    };
                                    if let Ok(json_str) = serde_json::to_string(&ev) {
                                        if tx_clone.send(json_str).await.is_err() {
                                            break;
                                        }
                                    }
                                }
                                SubMsg::Exit { code } => {
                                    let ev = WsEvent {
                                        event: "pty_exit".to_string(),
                                        payload: json!({
                                            "sessionId": sid_clone,
                                            "code": code
                                        }),
                                    };
                                    if let Ok(json_str) = serde_json::to_string(&ev) {
                                        let _ = tx_clone.send(json_str).await;
                                    }
                                    break;
                                }
                            }
                        }
                    }
                }
            });

            Ok(json!({
                "sessionId": res.id,
                "pid": res.pid
            }))
        }
        "pty_write" => {
            let session_id = args["sessionId"].as_str().ok_or("Missing sessionId")?;
            let data = args["data"].as_str().ok_or("Missing data")?;
            let mut mgr = pty_manager.lock().await;
            mgr.write(session_id, data)?;
            Ok(json!({ "status": "ok" }))
        }
        "pty_resize" => {
            let session_id = args["sessionId"].as_str().ok_or("Missing sessionId")?;
            let cols = args["cols"].as_u64().unwrap_or(80) as u32;
            let rows = args["rows"].as_u64().unwrap_or(24) as u32;
            let mut mgr = pty_manager.lock().await;
            mgr.resize(session_id, cols, rows)?;
            Ok(json!({ "status": "ok" }))
        }
        "pty_kill" => {
            let session_id = args["sessionId"].as_str().ok_or("Missing sessionId")?;
            let mut mgr = pty_manager.lock().await;
            mgr.kill(session_id)?;
            Ok(json!({ "status": "ok" }))
        }
        "get_system_info" => {
            let os = std::env::consts::OS;
            let arch = std::env::consts::ARCH;
            let has_nio = crate::nio_setup::find_nio_binary().is_some();
            let has_niodb = which_command("niodb") || which_command("nio-db");
            let has_niojs = which_command("nio-js");

            Ok(json!({
                "os": os,
                "arch": arch,
                "tools": {
                    "nio": has_nio,
                    "nioDb": has_niodb,
                    "nioJs": has_niojs
                }
            }))
        }
        "list_dirs" => {
            let path = args["path"].as_str().unwrap_or("/");
            let mut dirs = vec![];

            if path != "/" {
                dirs.push("..".to_string());
            }

            if let Ok(entries) = std::fs::read_dir(path) {
                for entry in entries.filter_map(Result::ok) {
                    if let Ok(ft) = entry.file_type() {
                        if ft.is_dir() {
                            dirs.push(entry.file_name().to_string_lossy().to_string());
                        }
                    }
                }
            }
            dirs.sort();
            Ok(json!({ "dirs": dirs, "current": path }))
        }
        _ => Err(format!("Unknown command: {}", cmd)),
    }
}

fn which_command(cmd: &str) -> bool {
    if let Ok(path) = std::env::var("PATH") {
        for dir in std::env::split_paths(&path) {
            let full = dir.join(cmd);
            if full.is_file() {
                return true;
            }
            #[cfg(windows)]
            {
                let exe = dir.join(format!("{}.exe", cmd));
                if exe.is_file() {
                    return true;
                }
            }
        }
    }
    false
}
