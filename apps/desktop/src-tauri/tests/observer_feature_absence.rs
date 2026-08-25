#![cfg(not(feature = "observer-command-channel"))]

use std::fs;

const FORBIDDEN_BINARY_SURFACE: &[&[u8]] = &[
    b"TMOC",
    b"TTRPG_OBSERVER_SOCKET_PATH",
    b"TTRPG_OBSERVER_SESSION",
    b"TTRPG_OBSERVER_CAPABILITY",
    b"TTRPG_OBSERVER_CONTROLLER_PID",
    b"TTRPG_OBSERVER_CANDIDATE_SHA256",
    b"observer://command",
    b"observer_frontend_ready",
    b"observer_command_started",
    b"observer_command_completed",
    b"LOCAL_PEERPID",
    b"BoundEndpoint",
    b"run_server",
];

#[test]
fn ordinary_desktop_binary_contains_no_observer_transport_surface() {
    let binary = fs::read(env!("CARGO_BIN_EXE_ttrpg-map-desktop"))
        .expect("Cargo must build the ordinary desktop binary for this integration test");
    for forbidden in FORBIDDEN_BINARY_SURFACE {
        assert!(
            !binary
                .windows(forbidden.len())
                .any(|window| window == *forbidden),
            "ordinary desktop binary contains forbidden observer transport bytes"
        );
    }
}

#[test]
fn ordinary_source_and_capability_surfaces_keep_the_feature_compile_time_only() {
    let manifest = include_str!("../Cargo.toml");
    assert!(manifest.contains("[features]\ndefault = []\nobserver-command-channel = []"));

    let library = include_str!("../src/lib.rs");
    assert!(
        library.contains(
            "#[cfg(feature = \"observer-command-channel\")]\nmod observer_command_channel;"
        )
    );
    assert!(!library.contains("pub mod observer_command_channel;"));

    let capability = include_str!("../capabilities/default.json");
    for forbidden in ["observer", "socket", "frontend_ready", "command_started"] {
        assert!(!capability.contains(forbidden));
    }
}
