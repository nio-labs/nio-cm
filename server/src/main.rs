mod pty;
mod ws;
mod nio_setup;

use axum::{
    extract::{ws::WebSocketUpgrade, State},
    response::{IntoResponse, Json},
    routing::get,
    Router,
};
use pty::PtyManager;
use serde_json::json;
use std::{net::SocketAddr, path::PathBuf, sync::Arc};
use tokio::sync::Mutex;
use tower_http::{
    cors::{Any, CorsLayer},
    services::ServeDir,
    trace::TraceLayer,
};

#[derive(Clone)]
struct AppState {
    pty_manager: Arc<Mutex<PtyManager>>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    nio_setup::ensure_nio_binary().await;
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "niocm=info,tower_http=info".into()),
        )
        .init();

    let pty_manager = Arc::new(Mutex::new(PtyManager::new()));
    let state = AppState {
        pty_manager: pty_manager.clone(),
    };

    // Clean shutdown handler for SIGINT/Ctrl+C
    {
        let pty_ref = pty_manager.clone();
        tokio::spawn(async move {
            tokio::signal::ctrl_c().await.expect("Failed to listen for Ctrl+C");
            tracing::info!("Received shutdown signal. Reaping all PTY sessions...");
            let mut mgr = pty_ref.lock().await;
            mgr.kill_all();
            std::process::exit(0);
        });
    }

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Detect web dist directory:
    // 1. Current dir: ./web/dist
    // 2. Relative to executable: ../web/dist
    let dist_dir = if PathBuf::from("web/dist").is_dir() {
        PathBuf::from("web/dist")
    } else if PathBuf::from("../web/dist").is_dir() {
        PathBuf::from("../web/dist")
    } else {
        PathBuf::from("web/dist")
    };

    let router = Router::new()
        .route("/ws", get(ws_handler))
        .route("/health", get(health_handler))
        .fallback_service(
            tower::ServiceBuilder::new()
                .service(if dist_dir.is_dir() {
                    ServeDir::new(dist_dir)
                } else {
                    ServeDir::new(".")
                })
        )
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], 1422));
    println!("┌────────────────────────────────────────────────────────┐");
    println!("│                                                        │");
    println!("│  🚀 NioCM — The Agentic Terminal Daemon               │");
    println!("│                                                        │");
    println!("│  ➜ Local UI:    http://localhost:1422                  │");
    println!("│  ➜ WebSocket:   ws://localhost:1422/ws                 │");
    println!("│  ➜ Core Agent:  NioAI (nio)                            │");
    println!("│                                                        │");
    println!("└────────────────────────────────────────────────────────┘");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, router).await?;

    Ok(())
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| ws::handle_socket(socket, state.pty_manager))
}

async fn health_handler() -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "app": "NioCM",
        "version": "0.1.0"
    }))
}
