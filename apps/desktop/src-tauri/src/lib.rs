pub mod mapworld_native;

#[cfg(feature = "observer-command-channel")]
mod observer_command_channel;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[cfg(not(feature = "observer-command-channel"))]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            mapworld_native::atlas_png::atlas_png_write_base64,
            mapworld_native::atlas_svg::atlas_svg_write_base64,
            mapworld_native::service::mapworld_native_snapshot,
            mapworld_native::service::mapworld_native_save_base64,
            mapworld_native::service::mapworld_native_apply,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run the TTRPG Map Generator desktop shell");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[cfg(feature = "observer-command-channel")]
pub fn run() {
    use tauri::Manager as _;

    let prepared = observer_command_channel::prepare();
    tauri::Builder::default()
        .setup(move |app| {
            let prepared = prepared.map_err(Box::<dyn std::error::Error>::from)?;
            observer_command_channel::install(app, prepared)
                .map_err(Box::<dyn std::error::Error>::from)
        })
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                window
                    .state::<observer_command_channel::ObserverBridge>()
                    .abort();
            }
        })
        .invoke_handler(tauri::generate_handler![
            mapworld_native::atlas_png::atlas_png_write_base64,
            mapworld_native::atlas_svg::atlas_svg_write_base64,
            mapworld_native::service::mapworld_native_snapshot,
            mapworld_native::service::mapworld_native_save_base64,
            mapworld_native::service::mapworld_native_apply,
            observer_command_channel::observer_frontend_ready,
            observer_command_channel::observer_command_started,
            observer_command_channel::observer_command_completed,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run the TTRPG Map Generator observer desktop shell");
}
