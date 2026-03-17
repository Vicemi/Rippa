#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use discord_rich_presence::{DiscordIpc, DiscordIpcClient};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::{Arc, Mutex};
use tauri::{Manager, SystemTray, SystemTrayEvent};
use tauri::{
    CustomMenuItem, SystemTrayMenu, SystemTrayMenuItem,
};
use tokio::sync::mpsc;

// Estado compartido entre el hilo WebSocket y Tauri
struct AppState {
    current_anime: Mutex<Option<AnimeData>>,
    discord_client: Mutex<Option<DiscordIpcClient>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AnimeData {
    titulo: Option<String>,
    episodio: Option<String>,
    generos: Option<Vec<String>>,
    url: Option<String>,
    imagen: Option<String>,
}

static CLIENT_ID: &str = "1091818330186338484";

#[tokio::main]
async fn main() {
    // Inicializar logger
    simple_logger::SimpleLogger::new().init().unwrap();

    // Crear el estado compartido
    let state = Arc::new(AppState {
        current_anime: Mutex::new(None),
        discord_client: Mutex::new(None),
    });

    // Inicializar Discord RPC (en un hilo aparte para no bloquear)
    {
        let state = state.clone();
        tauri::async_runtime::spawn(async move {
            init_discord_rpc(state).await;
        });
    }

    // Iniciar servidor WebSocket en un hilo separado
    {
        let state = state.clone();
        tauri::async_runtime::spawn(async move {
            start_websocket_server(state).await;
        });
    }

    // Construir menú de la bandeja
    let tray_menu = SystemTrayMenu::new()
        .add_item(CustomMenuItem::new("toggle".to_string(), "Mostrar/Ocultar"))
        .add_item(CustomMenuItem::new("extension".to_string(), "Abrir carpeta de extensión"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("quit".to_string(), "Salir"));

    let system_tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .system_tray(system_tray)
        .on_system_tray_event(move |app, event| match event {
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "toggle" => {
                    let window = app.get_window("main").unwrap();
                    if window.is_visible().unwrap() {
                        window.hide().unwrap();
                    } else {
                        window.show().unwrap();
                    }
                }
                "extension" => {
                    // Abrir carpeta de extensión (incluida en recursos)
                    let resource_path = app.path_resolver()
                        .resolve_resource("extension/")
                        .expect("failed to resolve resource");
                    open::that(resource_path).unwrap();
                }
                "quit" => {
                    std::process::exit(0);
                }
                _ => {}
            },
            SystemTrayEvent::LeftClick { .. } => {
                let window = app.get_window("main").unwrap();
                if window.is_visible().unwrap() {
                    window.hide().unwrap();
                } else {
                    window.show().unwrap();
                }
            }
            _ => {}
        })
        .manage(state) // Compartir el estado con los comandos
        .invoke_handler(tauri::generate_handler![hide_window])
        .setup(|app| {
            // Configurar la ventana principal (se crea automáticamente desde tauri.conf.json)
            let window = app.get_window("main").unwrap();
            // Hacer que la ventana se oculte al perder el foco
            let window_clone = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::Focused(false) = event {
                    window_clone.hide().unwrap();
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn hide_window(window: tauri::Window) {
    window.hide().unwrap();
}

async fn init_discord_rpc(state: Arc<AppState>) {
    loop {
        match DiscordIpcClient::new(CLIENT_ID) {
            Ok(mut client) => {
                log::info!("Conectando a Discord RPC...");
                if client.connect().is_ok() {
                    log::info!("✅ Discord RPC conectado");
                    // Guardar cliente en estado
                    *state.discord_client.lock().unwrap() = Some(client);

                    // Si ya hay datos de anime, actualizar presencia
                    if let Some(anime) = state.current_anime.lock().unwrap().clone() {
                        update_discord_presence(&mut *state.discord_client.lock().unwrap().as_mut().unwrap(), &anime);
                    }
                } else {
                    log::error!("❌ No se pudo conectar a Discord RPC");
                }
            }
            Err(e) => log::error!("Error al crear cliente Discord: {}", e),
        }
        tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
    }
}

fn update_discord_presence(client: &mut DiscordIpcClient, data: &AnimeData) {
    let titulo = data.titulo.as_deref().unwrap_or("Anime desconocido");
    let episodio = data.episodio.as_deref().unwrap_or("?");
    let generos = data.generos.as_ref().map(|g| {
        g.iter()
            .filter(|s| !s.contains("Términos") && !s.contains("Política") && !s.contains("Condiciones"))
            .take(3)
            .cloned()
            .collect::<Vec<_>>()
            .join(", ")
    }).unwrap_or_else(|| "Géneros no disponibles".to_string());
    let url = data.url.as_deref().unwrap_or("https://animeav1.com");
    let imagen = data.imagen.as_deref().unwrap_or("");

    let mut activity = discord_rich_presence::activity::Activity::new()
        .details(titulo)
        .state(&format!("Episodio {}", episodio))
        .assets(
            discord_rich_presence::activity::Assets::new()
                .large_text(&generos)
                .large_image(if imagen.is_empty() { "logo" } else { imagen }),
        )
        .buttons(vec![
            discord_rich_presence::activity::Button::new("Ver Anime", url),
            discord_rich_presence::activity::Button::new("Descargar Rippa", "https://github.com/Vicemi/Rippa"),
        ]);

    if let Err(e) = client.set_activity(activity) {
        log::error!("Error al actualizar presencia Discord: {}", e);
    } else {
        log::info!("Presencia actualizada");
    }
}

async fn start_websocket_server(state: Arc<AppState>) {
    let addr = "0.0.0.0:9876".to_string();
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    log::info!("✅ Servidor WebSocket escuchando en ws://{}", addr);

    while let Ok((stream, _)) = listener.accept().await {
        let state = state.clone();
        tokio::spawn(async move {
            handle_connection(stream, state).await;
        });
    }
}

async fn handle_connection(stream: tokio::net::TcpStream, state: Arc<AppState>) {
    let ws_stream = tokio_tungstenite::accept_async(stream).await.unwrap();
    let (mut sender, mut receiver) = ws_stream.split();

    while let Some(Ok(msg)) = receiver.next().await {
        if msg.is_text() || msg.is_binary() {
            let text = msg.to_text().unwrap();
            match serde_json::from_str::<serde_json::Value>(text) {
                Ok(payload) => {
                    if let Some(ty) = payload.get("type").and_then(|v| v.as_str()) {
                        match ty {
                            "update" => {
                                if let Some(data_val) = payload.get("payload") {
                                    if let Ok(anime) = serde_json::from_value::<AnimeData>(data_val.clone()) {
                                        // Actualizar estado
                                        {
                                            let mut current = state.current_anime.lock().unwrap();
                                            *current = Some(anime.clone());
                                        }
                                        // Actualizar Discord
                                        if let Some(client) = state.discord_client.lock().unwrap().as_mut() {
                                            update_discord_presence(client, &anime);
                                        }
                                    }
                                }
                            }
                            "clear" => {
                                // Limpiar presencia
                                if let Some(client) = state.discord_client.lock().unwrap().as_mut() {
                                    let _ = client.clear_activity();
                                }
                                *state.current_anime.lock().unwrap() = None;
                                // Emitir evento a la ventana con null
                            }
                            "status" => {
                                let current = state.current_anime.lock().unwrap().clone();
                                let response = serde_json::json!({
                                    "running": true,
                                    "currentAnime": current
                                });
                                let _ = sender.send(tokio_tungstenite::tungstenite::Message::Text(response.to_string())).await;
                            }
                            _ => {}
                        }
                    }
                }
                Err(e) => log::error!("Error parseando JSON: {}", e),
            }
        }
    }
}