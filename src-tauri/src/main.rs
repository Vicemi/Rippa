#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use discord_rich_presence::{DiscordIpc, DiscordIpcClient};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WebviewWindow,
};
use tokio::sync::mpsc;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AnimeData {
    titulo: Option<String>,
    episodio: Option<String>,
    generos: Option<Vec<String>>,
    url: Option<String>,
    imagen: Option<String>,
}

struct AppState {
    current_anime: Mutex<Option<AnimeData>>,
    discord_client: Mutex<Option<DiscordIpcClient>>,
    event_sender: mpsc::UnboundedSender<Option<AnimeData>>,
}

const CLIENT_ID: &str = "1091818330186338484";

#[tokio::main]
async fn main() {
    simple_logger::SimpleLogger::new().init().unwrap();

    let (event_sender, mut event_receiver) = mpsc::unbounded_channel();

    let state = Arc::new(AppState {
        current_anime: Mutex::new(None),
        discord_client: Mutex::new(None),
        event_sender,
    });

    // Discord RPC
    {
        let state = state.clone();
        tokio::spawn(async move {
            init_discord_rpc(state).await;
        });
    }

    // WebSocket server
    {
        let state = state.clone();
        tokio::spawn(async move {
            start_websocket_server(state).await;
        });
    }

    tauri::Builder::default()
        .setup(move |app| {
            // ===== MENU (FIX Tauri v2) =====
            let toggle_item =
                MenuItemBuilder::with_id("toggle", "Mostrar/Ocultar").build(app)?;

            let extension_item =
                MenuItemBuilder::with_id("extension", "Abrir carpeta de extensión")
                    .build(app)?;

            let quit_item =
                MenuItemBuilder::with_id("quit", "Salir").build(app)?;

            let menu = MenuBuilder::new(app)
                .items(&[&toggle_item, &extension_item, &quit_item])
                .build()?;

            let tray_icon = app.default_window_icon().unwrap().clone();

            TrayIconBuilder::new()
                .icon(tray_icon)
                .menu(&menu)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "toggle" => {
                        if let Some(window) = app.get_webview_window("main") {
                            toggle_window_visibility(&window);
                        }
                    }
                    "extension" => {
                        if let Ok(resource_path) = app
                            .path()
                            .resolve("extension/", tauri::path::BaseDirectory::Resource)
                        {
                            let _ = open::that(resource_path);
                        }
                    }
                    "quit" => std::process::exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            toggle_window_visibility(&window);
                        }
                    }
                })
                .build(app)?;

            // Hide on blur
            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::Focused(false) = event {
                        let _ = window_clone.hide();
                    }
                });
            }

            // Forward WS → frontend
            let app_handle = app.handle().clone();
            tokio::spawn(async move {
                while let Some(data) = event_receiver.recv().await {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = window.emit("anime-data", &data);
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![hide_window])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn toggle_window_visibility(window: &WebviewWindow) {
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        let _ = window.show();
    }
}

#[tauri::command]
fn hide_window(window: WebviewWindow) {
    let _ = window.hide();
}

async fn init_discord_rpc(state: Arc<AppState>) {
    loop {
        match DiscordIpcClient::new(CLIENT_ID) {
            Ok(mut client) => {
                if client.connect().is_ok() {
                    *state.discord_client.lock().unwrap() = Some(client);

                    if let Some(anime) = state.current_anime.lock().unwrap().clone() {
                        if let Some(client) = state.discord_client.lock().unwrap().as_mut() {
                            update_discord_presence(client, &anime);
                        }
                    }
                }
            }
            Err(_) => {}
        }
        tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
    }
}

fn update_discord_presence(client: &mut DiscordIpcClient, data: &AnimeData) {
    let titulo = data.titulo.as_deref().unwrap_or("Anime desconocido");
    let episodio = data.episodio.as_deref().unwrap_or("?");

    let state_text = format!("Episodio {}", episodio);

    let generos = data
        .generos
        .as_ref()
        .map(|g| {
            g.iter()
                .filter(|s| {
                    !s.contains("Términos") && !s.contains("Política") && !s.contains("Condiciones")
                })
                .take(3)
                .cloned()
                .collect::<Vec<_>>()
                .join(", ")
        })
        .unwrap_or_else(|| "Géneros no disponibles".to_string());

    let url = data.url.as_deref().unwrap_or("https://animeav1.com");
    let imagen = data.imagen.as_deref().unwrap_or("");

    let activity = discord_rich_presence::activity::Activity::new()
        .details(titulo)
        .state(&state_text)
        .assets(
            discord_rich_presence::activity::Assets::new()
                .large_text(&generos)
                .large_image(if imagen.is_empty() { "logo" } else { imagen }),
        )
        .buttons(vec![
            discord_rich_presence::activity::Button::new("Ver Anime", url),
            discord_rich_presence::activity::Button::new(
                "Descargar Rippa",
                "https://github.com/Vicemi/Rippa",
            ),
        ]);

    let _ = client.set_activity(activity);
}

async fn start_websocket_server(state: Arc<AppState>) {
    let listener = tokio::net::TcpListener::bind("0.0.0.0:9876")
        .await
        .unwrap();

    while let Ok((stream, _)) = listener.accept().await {
        let state = state.clone();
        tokio::spawn(async move {
            handle_connection(stream, state).await;
        });
    }
}

async fn handle_connection(stream: tokio::net::TcpStream, state: Arc<AppState>) {
    use futures_util::{SinkExt, StreamExt};
    use tokio_tungstenite::tungstenite::Message;

    let ws_stream = tokio_tungstenite::accept_async(stream).await.unwrap();
    let (mut sender, mut receiver) = ws_stream.split();

    while let Some(Ok(msg)) = receiver.next().await {
        if let Ok(text) = msg.to_text() {
            if let Ok(payload) = serde_json::from_str::<serde_json::Value>(text) {
                if let Some("update") = payload.get("type").and_then(|v| v.as_str()) {
                    if let Some(data_val) = payload.get("payload") {
                        if let Ok(anime) =
                            serde_json::from_value::<AnimeData>(data_val.clone())
                        {
                            *state.current_anime.lock().unwrap() = Some(anime.clone());
                            let _ = state.event_sender.send(Some(anime.clone()));

                            if let Some(client) =
                                state.discord_client.lock().unwrap().as_mut()
                            {
                                update_discord_presence(client, &anime);
                            }

                            let _ = sender.send(Message::text(r#"{"status":"ok"}"#)).await;
                        }
                    }
                }
            }
        }
    }
}