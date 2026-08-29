// The all-features Linux gate compiles the fail-closed unsupported-platform entry point, but only
// the macOS server can drive these transport internals in a non-test build.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
mod bridge;
mod error;
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
mod protocol;

#[cfg(target_os = "macos")]
mod bootstrap;
#[cfg(target_os = "macos")]
mod platform_macos;
#[cfg(target_os = "macos")]
mod server_macos;

pub(crate) use bridge::ObserverBridge;
use error::ObserverError;

#[cfg(target_os = "macos")]
pub(crate) type Prepared = bootstrap::Bootstrap;

#[cfg(not(target_os = "macos"))]
pub(crate) struct Prepared;

#[cfg(target_os = "macos")]
pub(crate) fn prepare() -> Result<Prepared, ObserverError> {
    bootstrap::load()
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn prepare() -> Result<Prepared, ObserverError> {
    Err(ObserverError::UnsupportedPlatform)
}

#[cfg(target_os = "macos")]
pub(crate) fn install(app: &mut tauri::App, prepared: Prepared) -> Result<(), ObserverError> {
    server_macos::install(app, prepared)
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn install(_app: &mut tauri::App, _prepared: Prepared) -> Result<(), ObserverError> {
    Err(ObserverError::UnsupportedPlatform)
}

#[tauri::command]
pub(crate) fn observer_frontend_ready(
    state: tauri::State<'_, ObserverBridge>,
) -> Result<(), String> {
    state.frontend_ready().map_err(stable_error)
}

#[tauri::command]
pub(crate) fn observer_command_started(
    sequence: u64,
    state: tauri::State<'_, ObserverBridge>,
) -> Result<(), String> {
    state.command_started(sequence).map_err(stable_error)
}

#[tauri::command]
pub(crate) fn observer_command_completed(
    sequence: u64,
    status: u16,
    receipt: String,
    state: tauri::State<'_, ObserverBridge>,
) -> Result<(), String> {
    state
        .command_completed(sequence, status, &receipt)
        .map_err(stable_error)
}

fn stable_error(error: ObserverError) -> String {
    error.code().to_owned()
}

#[cfg(all(test, not(target_os = "macos")))]
mod unsupported_tests {
    use super::*;

    #[test]
    fn enabled_unsupported_platform_fails_closed_before_listening() {
        assert!(matches!(prepare(), Err(ObserverError::UnsupportedPlatform)));
    }
}
