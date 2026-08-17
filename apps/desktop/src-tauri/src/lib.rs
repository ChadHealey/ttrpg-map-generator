pub mod mapworld_native;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            mapworld_native::service::mapworld_native_snapshot,
            mapworld_native::service::mapworld_native_save_base64,
            mapworld_native::service::mapworld_native_apply,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run the TTRPG Map Generator desktop shell");
}
