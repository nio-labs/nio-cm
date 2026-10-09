mod nio_setup;
mod pty;
mod ws;

use axum::{
    extract::{ws::WebSocketUpgrade, State},
    http::{header, StatusCode, Uri},
    response::{IntoResponse, Json, Response},
    routing::get,
    Router,
};
use pty::PtyManager;
use rust_embed::RustEmbed;
use serde_json::json;
use std::{net::SocketAddr, path::PathBuf, sync::Arc};
use tokio::sync::Mutex;
use tower_http::{
    cors::{Any, CorsLayer},
    services::ServeDir,
    trace::TraceLayer,
};

#[derive(RustEmbed)]
#[folder = "../web/dist/"]
struct EmbeddedAssets;

#[derive(Clone)]
struct AppState {
    pty_manager: Arc<Mutex<PtyManager>>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().skip(1).collect();

    if args.iter().any(|a| a == "--version" || a == "-V") {
        println!("niocm {}", env!("CARGO_PKG_VERSION"));
        return Ok(());
    }

    if args.iter().any(|a| a == "--help" || a == "-h") {
        print!(
            "{}",
            concat!(
                "niocm ",
                env!("CARGO_PKG_VERSION"),
                " — The Agentic Terminal Daemon\n\n",
                "USAGE:\n",
                "    niocm [OPTIONS]\n\n",
                "OPTIONS:\n",
                "    --port, -p <port>  Port to bind to (default 1422 or PORT env)\n",
                "    --host, -H <host>  Host to bind to (default 0.0.0.0 or HOST env)\n",
                "    --version, -V      Print version and exit\n",
                "    --help, -h         Print this help\n\n",
                "ENVIRONMENT:\n",
                "    PORT               Port to bind to (auto-detected on Railway & Koyeb)\n",
                "    HOST               Host to bind to (default 0.0.0.0)\n",
                "    NIOCM_STATIC_DIR   Override static files directory\n",
            )
        );
        return Ok(());
    }

    let mut port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(1422);

    let mut host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());

    // CLI flags override
    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--port" | "-p" => {
                if let Some(val) = args.get(i + 1) {
                    if let Ok(p) = val.parse() {
                        port = p;
                    }
                    i += 1;
                }
            }
            "--host" | "-H" => {
                if let Some(val) = args.get(i + 1) {
                    host = val.clone();
                    i += 1;
                }
            }
            _ => {}
        }
        i += 1;
    }

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
            tokio::signal::ctrl_c()
                .await
                .expect("Failed to listen for Ctrl+C");
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
    // 1. Env var NIOCM_STATIC_DIR
    // 2. Current dir: ./web/dist
    // 3. Relative to executable: ../web/dist
    let dist_dir = std::env::var("NIOCM_STATIC_DIR")
        .ok()
        .map(PathBuf::from)
        .or_else(|| {
            if PathBuf::from("web/dist").is_dir() {
                Some(PathBuf::from("web/dist"))
            } else if PathBuf::from("../web/dist").is_dir() {
                Some(PathBuf::from("../web/dist"))
            } else {
                None
            }
        });

    let router = Router::new()
        .route("/ws", get(ws_handler))
        .route("/health", get(health_handler))
        .fallback(move |uri: Uri| {
            let dist_opt = dist_dir.clone();
            async move {
                if let Some(ref d) = dist_opt {
                    let service = ServeDir::new(d);
                    use tower::ServiceExt;
                    let req = axum::http::Request::builder()
                        .uri(uri.clone())
                        .body(axum::body::Body::empty())
                        .unwrap();
                    let res = service.oneshot(req).await.unwrap();
                    if res.status() != StatusCode::NOT_FOUND {
                        return res.into_response();
                    }
                }
                serve_embedded(uri).await
            }
        })
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr: SocketAddr = format!("{}:{}", host, port)
        .parse()
        .unwrap_or_else(|_| SocketAddr::from(([0, 0, 0, 0], 1422)));

    let display_host = if host == "0.0.0.0" {
        "localhost"
    } else {
        &host
    };
    println!("┌────────────────────────────────────────────────────────┐");
    println!("│                                                        │");
    println!("│  🚀 NioCM — The Agentic Terminal Daemon               │");
    println!("│                                                        │");
    println!(
        "│  ➜ Local UI:    http://{}:{:<5}                 │",
        display_host, port
    );
    println!(
        "│  ➜ WebSocket:   ws://{}:{}/ws{:<4}              │",
        display_host, port, ""
    );
    println!("│  ➜ Core Agent:  NioAI (nio)                            │");
    println!("│                                                        │");
    println!("└────────────────────────────────────────────────────────┘");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, router).await?;

    Ok(())
}

async fn serve_embedded(uri: Uri) -> Response {
    let raw_path = uri.path().trim_start_matches('/');
    let path = if raw_path.is_empty() {
        "index.html"
    } else {
        raw_path
    };

    if let Some(content) = EmbeddedAssets::get(path) {
        let mime = mime_guess::from_path(path).first_or_octet_stream();
        return ([(header::CONTENT_TYPE, mime.as_ref())], content.data).into_response();
    }

    // SPA fallback
    if let Some(content) = EmbeddedAssets::get("index.html") {
        let mime = mime_guess::from_path("index.html").first_or_octet_stream();
        return ([(header::CONTENT_TYPE, mime.as_ref())], content.data).into_response();
    }

    (StatusCode::NOT_FOUND, "Not Found").into_response()
}

async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| ws::handle_socket(socket, state.pty_manager))
}

async fn health_handler() -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "app": "NioCM",
        "version": env!("CARGO_PKG_VERSION")
    }))
}
