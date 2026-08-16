use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use ttrpg_map_desktop_lib::mapworld_native::ObservationKind;
use ttrpg_map_desktop_lib::mapworld_native::service::{
    mapworld_native_save, mapworld_native_snapshot, snapshot_target,
};

use super::support::TestDirectory;

#[test]
fn desktop_generate_reroll_native_save_close_and_generator_free_reopen() {
    let test_directory = TestDirectory::new("milestone-one-workflow");
    let target = test_directory.target();
    let requests = test_directory.0.join("bridge-requests");
    fs::create_dir(&requests).expect("create bridge request directory");
    let bridge = build_bridge();
    let mut child = Command::new("node")
        .arg(bridge)
        .arg(target.to_str().expect("UTF-8 target path"))
        .arg(requests.to_str().expect("UTF-8 request path"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .expect("start Milestone 1 native workflow bridge");
    let mut input = child.stdin.take().expect("bridge stdin");
    let mut output = BufReader::new(child.stdout.take().expect("bridge stdout"));

    let save_call = read_bridge_line(&mut output);
    assert_eq!(save_call, "CALL\t0\tmapworld_native_save");
    let save_request = read_save_request(&requests.join("0"));
    let save_response = mapworld_native_save(
        save_request.target_path,
        save_request.operation,
        save_request.expected_previous_manifest_sha256,
        save_request.expected_previous_observation_token,
        save_request.candidate_manifest_sha256,
        save_request.marker_bytes,
        save_request.relative_paths,
        save_request.file_bytes,
    );
    writeln!(input, "{save_response}").expect("return native save response");
    input.flush().expect("flush native save response");

    let snapshot_call = read_bridge_line(&mut output);
    assert_eq!(snapshot_call, "CALL\t1\tmapworld_native_snapshot");
    let snapshot_target_path = read_single_line(&requests.join("1/metadata.txt"));
    let snapshot_response = mapworld_native_snapshot(snapshot_target_path);
    writeln!(input, "{snapshot_response}").expect("return native snapshot response");
    input.flush().expect("flush native snapshot response");

    let completed = read_bridge_line(&mut output);
    let fields = completed.split('\t').collect::<Vec<_>>();
    assert_eq!(fields.first(), Some(&"DONE"));
    assert_eq!(fields.get(1), Some(&"PASS"), "bridge result: {completed}");
    assert_eq!(fields.get(2), Some(&"0"), "reopen invoked generation");
    assert_eq!(fields.get(3).map(|value| value.len()), Some(64));
    assert_eq!(fields.get(4).map(|value| value.len()), Some(64));
    drop(input);
    let status = child.wait().expect("wait for workflow bridge");
    assert!(status.success(), "workflow bridge failed: {completed}");

    let clean = snapshot_target(target.to_str().expect("UTF-8 target")).expect("snapshot target");
    assert!(matches!(clean.target.kind, ObservationKind::Directory(_)));
    assert!(matches!(clean.temporary.kind, ObservationKind::Absent));
    assert!(matches!(clean.backup.kind, ObservationKind::Absent));
    assert!(matches!(clean.marker.kind, ObservationKind::Absent));
    println!(
        "milestone-one-native-workflow platform={} generator_calls_on_reopen=0 manifest_sha256={}",
        std::env::consts::OS,
        fields[3]
    );
}

struct BridgeSaveRequest {
    target_path: String,
    operation: String,
    expected_previous_manifest_sha256: Option<String>,
    expected_previous_observation_token: Option<String>,
    candidate_manifest_sha256: String,
    marker_bytes: Vec<u8>,
    relative_paths: Vec<String>,
    file_bytes: Vec<Vec<u8>>,
}

fn read_save_request(directory: &Path) -> BridgeSaveRequest {
    assert_eq!(
        read_single_line(&directory.join("command.txt")),
        "mapworld_native_save"
    );
    let metadata = fs::read_to_string(directory.join("metadata.txt"))
        .expect("read save metadata")
        .lines()
        .map(str::to_owned)
        .collect::<Vec<_>>();
    assert_eq!(metadata.len(), 5);
    let relative_paths = fs::read_to_string(directory.join("paths.txt"))
        .expect("read save paths")
        .lines()
        .map(str::to_owned)
        .collect::<Vec<_>>();
    let file_bytes = (0..relative_paths.len())
        .map(|index| {
            fs::read(directory.join(format!("files/{index}.bin")))
                .expect("read canonical save file bytes")
        })
        .collect();
    BridgeSaveRequest {
        target_path: metadata[0].clone(),
        operation: metadata[1].clone(),
        expected_previous_manifest_sha256: optional_metadata(&metadata[2]),
        expected_previous_observation_token: optional_metadata(&metadata[3]),
        candidate_manifest_sha256: metadata[4].clone(),
        marker_bytes: fs::read(directory.join("marker.bin")).expect("read marker bytes"),
        relative_paths,
        file_bytes,
    }
}

fn optional_metadata(value: &str) -> Option<String> {
    (value != "-").then(|| value.to_owned())
}

fn read_bridge_line(output: &mut BufReader<std::process::ChildStdout>) -> String {
    let mut line = String::new();
    output.read_line(&mut line).expect("read bridge line");
    assert!(!line.is_empty(), "workflow bridge exited unexpectedly");
    line.trim_end_matches(['\r', '\n']).to_owned()
}

fn read_single_line(path: &Path) -> String {
    fs::read_to_string(path)
        .expect("read single-line bridge file")
        .trim_end_matches(['\r', '\n'])
        .to_owned()
}

fn build_bridge() -> PathBuf {
    let repository = Path::new(env!("CARGO_MANIFEST_DIR"))
        .ancestors()
        .nth(3)
        .expect("src-tauri is nested under the repository root")
        .to_path_buf();
    let build = Command::new("corepack")
        .args([
            "pnpm",
            "--filter",
            "@ttrpg-map/desktop",
            "exec",
            "vite",
            "build",
            "--config",
            "vite.milestone-one-native-workflow.config.ts",
        ])
        .current_dir(&repository)
        .output()
        .expect("build Milestone 1 workflow bridge");
    assert!(
        build.status.success(),
        "workflow bridge build failed\nstdout:\n{}\nstderr:\n{}",
        String::from_utf8_lossy(&build.stdout),
        String::from_utf8_lossy(&build.stderr)
    );
    Path::new(env!("CARGO_MANIFEST_DIR")).join("target/milestone-one-native-workflow/bridge.mjs")
}
