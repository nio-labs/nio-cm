use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;

pub const RING_CAP: usize = 256 * 1024;
const FEED_CAP: usize = 256;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtySession {
    pub id: String,
    pub pid: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachInfo {
    pub pid: u32,
    pub from: u64,
    pub end: u64,
    pub truncated: bool,
}

#[derive(Debug)]
pub enum SubMsg {
    Out { from: u64, data: Vec<u8> },
    Exit { code: Option<i32> },
}

enum Ctrl {
    Subscribe {
        tx: mpsc::Sender<SubMsg>,
        from: u64,
    },
    Unsubscribe,
}

enum Out {
    Data(Vec<u8>),
    Eof(Option<i32>),
}

pub struct SessionState {
    pub exited: bool,
    pub exit_code: Option<i32>,
    pub total: u64,
    pub detached_at: Option<std::time::Instant>,
    ring: VecDeque<u8>,
    ring_start: u64,
}

impl SessionState {
    fn new() -> Self {
        Self {
            exited: false,
            exit_code: None,
            total: 0,
            detached_at: None,
            ring: VecDeque::new(),
            ring_start: 0,
        }
    }

    fn push(&mut self, bytes: &[u8]) {
        self.ring.extend(bytes.iter().copied());
        while self.ring.len() > RING_CAP {
            self.ring.pop_front();
            self.ring_start += 1;
        }
        self.total += bytes.len() as u64;
    }

    pub fn ring_start(&self) -> u64 {
        self.ring_start
    }

    fn replay_from(&self, from: u64) -> (u64, Vec<u8>) {
        let start = self.ring_start.max(from);
        let skip = (start - self.ring_start) as usize;
        (start, self.ring.iter().skip(skip).copied().collect())
    }
}

struct Session {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    child: Arc<Mutex<Box<dyn Child + Send + Sync>>>,
    pid: u32,
    #[allow(dead_code)]
    feed: mpsc::Sender<Out>,
    ctrl: mpsc::UnboundedSender<Ctrl>,
    state: Arc<Mutex<SessionState>>,
    #[allow(dead_code)]
    task: tokio::task::JoinHandle<()>,
}

pub struct PtyManager {
    sessions: HashMap<String, Session>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    pub fn spawn(
        &mut self,
        session_id: String,
        shell: Option<String>,
        args: Option<Vec<String>>,
        cwd: Option<String>,
        cols: u32,
        rows: u32,
    ) -> Result<PtySession, String> {
        let mut shell_path = shell.unwrap_or_else(|| {
            if cfg!(target_os = "windows") {
                "powershell.exe".to_string()
            } else {
                for candidate in &["/bin/zsh", "/bin/bash", "/bin/sh"] {
                    if std::path::Path::new(candidate).exists() {
                        return candidate.to_string();
                    }
                }
                "/bin/sh".to_string()
            }
        });

        if shell_path == "nio" {
            if let Some(resolved) = crate::nio_setup::find_nio_binary() {
                shell_path = resolved.to_string_lossy().to_string();
            }
        }

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: rows.max(1) as u16,
                cols: cols.max(1) as u16,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to open pty: {}", e))?;

        let mut cmd = CommandBuilder::new(&shell_path);

        if let Some(arg_list) = args {
            for arg in arg_list {
                cmd.arg(arg);
            }
        }

        if let Some(dir) = cwd.as_deref() {
            if std::path::Path::new(dir).is_dir() {
                cmd.cwd(dir);
            }
        }

        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        cmd.env("TERM_PROGRAM", "NioCM");
        cmd.env("SHELL", &shell_path);
        cmd.env("SHLVL", "1");

        let child = pair.slave.spawn_command(cmd).map_err(|e| {
            format!(
                "Failed to spawn command '{}' (cwd: {:?}): {}",
                shell_path, cwd, e
            )
        })?;
        let pid = child.process_id().unwrap_or(0);
        let child = Arc::new(Mutex::new(child));

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to get pty writer: {}", e))?;
        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to get pty reader: {}", e))?;

        let state = Arc::new(Mutex::new(SessionState::new()));
        let (feed_tx, mut feed_rx) = mpsc::channel::<Out>(FEED_CAP);
        let (ctrl_tx, mut ctrl_rx) = mpsc::unbounded_channel::<Ctrl>();

        {
            let feed = feed_tx.clone();
            let child_ref = child.clone();
            std::thread::spawn(move || {
                let mut reader = reader;
                let mut buf = [0u8; 4096];
                loop {
                    match reader.read(&mut buf) {
                        Ok(0) => break,
                        Ok(n) => {
                            if feed.blocking_send(Out::Data(buf[..n].to_vec())).is_err() {
                                return;
                            }
                        }
                        Err(_) => break,
                    }
                }
                let code = {
                    let mut c = child_ref.lock().unwrap();
                    c.wait().ok().and_then(|s| s.exit_code().try_into().ok())
                };
                let _ = feed.blocking_send(Out::Eof(code));
            });
        }

        let task = {
            let state = state.clone();
            tokio::spawn(async move {
                let mut sub: Option<mpsc::Sender<SubMsg>> = None;
                loop {
                    tokio::select! {
                        biased;
                        c = ctrl_rx.recv() => match c {
                            Some(Ctrl::Subscribe { tx, from }) => {
                                let (start, bytes) = {
                                    let st = state.lock().unwrap();
                                    st.replay_from(from)
                                };
                                if !bytes.is_empty()
                                    && tx.send(SubMsg::Out { from: start, data: bytes })
                                        .await
                                        .is_err()
                                {
                                    continue;
                                }
                                state.lock().unwrap().detached_at = None;
                                sub = Some(tx);
                            }
                            Some(Ctrl::Unsubscribe) => {
                                sub = None;
                                state.lock().unwrap().detached_at = Some(std::time::Instant::now());
                            }
                            None => break,
                        },
                        o = feed_rx.recv() => match o {
                            Some(Out::Data(bytes)) => {
                                let from = {
                                    let mut st = state.lock().unwrap();
                                    st.push(&bytes);
                                    st.total - bytes.len() as u64
                                };
                                if let Some(tx) = &sub {
                                    if tx.send(SubMsg::Out { from, data: bytes })
                                        .await
                                        .is_err()
                                    {
                                        sub = None;
                                    }
                                }
                            }
                            Some(Out::Eof(code)) => {
                                {
                                    let mut st = state.lock().unwrap();
                                    st.exited = true;
                                    st.exit_code = code;
                                    st.detached_at = None;
                                }
                                if let Some(tx) = sub.take() {
                                    let _ = tx.send(SubMsg::Exit { code }).await;
                                }
                            }
                            None => break,
                        },
                    }
                }
                let exited = state.lock().unwrap().exited;
                if !exited {
                    if let Some(tx) = sub {
                        let _ = tx.send(SubMsg::Exit { code: None }).await;
                    }
                }
            })
        };

        self.sessions.insert(
            session_id.clone(),
            Session {
                writer,
                master: pair.master,
                child,
                pid,
                feed: feed_tx,
                ctrl: ctrl_tx,
                state,
                task,
            },
        );

        Ok(PtySession {
            id: session_id,
            pid,
        })
    }

    pub fn write(&mut self, session_id: &str, data: &str) -> Result<(), String> {
        if let Some(session) = self.sessions.get_mut(session_id) {
            session
                .writer
                .write_all(data.as_bytes())
                .map_err(|e| format!("Write error: {}", e))?;
            Ok(())
        } else {
            Err(format!("Session {} not found", session_id))
        }
    }

    pub fn resize(&mut self, session_id: &str, cols: u32, rows: u32) -> Result<(), String> {
        if let Some(session) = self.sessions.get_mut(session_id) {
            session
                .master
                .resize(PtySize {
                    rows: rows.max(1) as u16,
                    cols: cols.max(1) as u16,
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|e| format!("Resize error: {}", e))?;
            Ok(())
        } else {
            Err(format!("Session {} not found", session_id))
        }
    }

    pub fn attach(
        &self,
        session_id: &str,
        tx: mpsc::Sender<SubMsg>,
        from: u64,
    ) -> Result<AttachInfo, String> {
        let session = self
            .sessions
            .get(session_id)
            .ok_or_else(|| format!("Session {} not found", session_id))?;
        let (pid, from_actual, end, truncated) = {
            let st = session.state.lock().unwrap();
            let from_actual = st.ring_start().max(from);
            (
                session.pid,
                from_actual,
                st.total,
                from < st.ring_start(),
            )
        };
        session
            .ctrl
            .send(Ctrl::Subscribe {
                tx,
                from: from_actual,
            })
            .map_err(|_| "Stream task gone".to_string())?;
        Ok(AttachInfo {
            pid,
            from: from_actual,
            end,
            truncated,
        })
    }

    pub fn kill(&mut self, session_id: &str) -> Result<(), String> {
        if let Some(session) = self.sessions.remove(session_id) {
            let _ = session.ctrl.send(Ctrl::Unsubscribe);
            let mut child = session.child.lock().unwrap();
            let _ = child.kill();
            Ok(())
        } else {
            Err(format!("Session {} not found", session_id))
        }
    }

    pub fn kill_all(&mut self) {
        for (_, session) in self.sessions.drain() {
            let _ = session.ctrl.send(Ctrl::Unsubscribe);
            let mut child = session.child.lock().unwrap();
            let _ = child.kill();
        }
    }

    #[allow(dead_code)]
    pub fn session_count(&self) -> usize {
        self.sessions.len()
    }
}
