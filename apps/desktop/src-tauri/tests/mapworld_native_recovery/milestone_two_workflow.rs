use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use ttrpg_map_desktop_lib::mapworld_native::service::{
    NativeSaveRequest, execute_save, mapworld_native_apply, mapworld_native_save,
    mapworld_native_snapshot, snapshot_target,
};
use ttrpg_map_desktop_lib::mapworld_native::{FaultMode, FaultSpec, ObservationKind};

use super::support::TestDirectory;

#[test]
fn complete_atlas_native_save_interrupted_replacement_recovery_and_generator_free_reopen() {
    let test_directory = TestDirectory::new("milestone-two-workflow");
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
        .expect("start Milestone 2 native workflow bridge");
    let mut input = child.stdin.take().expect("bridge stdin");
    let mut output = BufReader::new(child.stdout.take().expect("bridge stdout"));
    let mut replacement_fault_injected = false;
    let completed = loop {
        let line = read_bridge_line(&mut output);
        if line.starts_with("DONE\t") {
            break line;
        }
        let fields = line.split('\t').collect::<Vec<_>>();
        assert_eq!(fields.first(), Some(&"CALL"));
        let sequence = fields
            .get(1)
            .expect("call sequence")
            .parse::<usize>()
            .expect("numeric call sequence");
        let command = *fields.get(2).expect("call command");
        let directory = requests.join(sequence.to_string());
        let response = match command {
            "mapworld_native_save_base64" => {
                let request = read_save_request(&directory);
                if request.operation == "replacement-save" {
                    replacement_fault_injected = true;
                    execute_save(
                        &request,
                        Some(FaultSpec {
                            point: 9,
                            occurrence: 1,
                            mode: FaultMode::TerminateAfter,
                            hard_terminate: false,
                            os_error_number: None,
                        }),
                    )
                    .expect_err("replacement must stop after durable candidate preparation")
                    .to_json()
                } else {
                    mapworld_native_save(
                        request.target_path,
                        request.operation,
                        request.expected_previous_manifest_sha256,
                        request.expected_previous_observation_token,
                        request.candidate_manifest_sha256,
                        request.marker_bytes,
                        request.relative_paths,
                        request.file_bytes,
                    )
                }
            }
            "mapworld_native_snapshot" => {
                mapworld_native_snapshot(read_single_line(&directory.join("metadata.txt")))
            }
            "mapworld_native_apply" => {
                let request = read_apply_request(&directory);
                mapworld_native_apply(
                    request.target_path,
                    request.expected_snapshot_id,
                    request.selected_role,
                    request.selected_observation_token,
                    request.selected_manifest_sha256,
                    request.steps,
                    request.confirmation_tokens,
                )
            }
            other => panic!("unexpected bridge command {other}"),
        };
        writeln!(input, "{response}").expect("return native response");
        input.flush().expect("flush native response");
    };

    let fields = completed.split('\t').collect::<Vec<_>>();
    assert_eq!(fields.first(), Some(&"DONE"));
    assert_eq!(fields.get(1), Some(&"PASS"), "bridge result: {completed}");
    assert_eq!(fields.get(2), Some(&"0"), "reopen invoked generation");
    assert_eq!(fields.get(3).map(|value| value.len()), Some(64));
    assert!(replacement_fault_injected);
    drop(input);
    let status = child.wait().expect("wait for workflow bridge");
    assert!(status.success(), "workflow bridge failed: {completed}");

    let clean = snapshot_target(target.to_str().expect("UTF-8 target")).expect("snapshot target");
    assert!(matches!(clean.target.kind, ObservationKind::Directory(_)));
    assert!(matches!(clean.temporary.kind, ObservationKind::Absent));
    assert!(matches!(clean.backup.kind, ObservationKind::Absent));
    assert!(matches!(clean.marker.kind, ObservationKind::Absent));
    println!(
        "milestone-two-native-workflow platform={} generator_calls_on_reopen=0 manifest_sha256={}",
        std::env::consts::OS,
        fields[3]
    );
}

struct BridgeApplyRequest {
    target_path: String,
    expected_snapshot_id: String,
    selected_role: Option<String>,
    selected_observation_token: Option<String>,
    selected_manifest_sha256: Option<String>,
    steps: Vec<String>,
    confirmation_tokens: Vec<String>,
}

fn read_save_request(directory: &Path) -> NativeSaveRequest {
    assert_eq!(
        read_single_line(&directory.join("command.txt")),
        "mapworld_native_save_base64"
    );
    let metadata = read_lines(&directory.join("metadata.txt"));
    let relative_paths = read_lines(&directory.join("paths.txt"));
    let file_bytes = (0..relative_paths.len())
        .map(|index| fs::read(directory.join(format!("files/{index}.bin"))).expect("read file"))
        .collect();
    NativeSaveRequest {
        target_path: metadata[0].clone(),
        operation: metadata[1].clone(),
        expected_previous_manifest_sha256: optional_metadata(&metadata[2]),
        expected_previous_observation_token: optional_metadata(&metadata[3]),
        candidate_manifest_sha256: metadata[4].clone(),
        marker_bytes: fs::read(directory.join("marker.bin")).expect("read marker"),
        relative_paths,
        file_bytes,
    }
}

fn read_apply_request(directory: &Path) -> BridgeApplyRequest {
    let metadata = read_lines(&directory.join("metadata.txt"));
    BridgeApplyRequest {
        target_path: metadata[0].clone(),
        expected_snapshot_id: metadata[1].clone(),
        selected_role: optional_metadata(&metadata[2]),
        selected_observation_token: optional_metadata(&metadata[3]),
        selected_manifest_sha256: optional_metadata(&metadata[4]),
        steps: read_lines(&directory.join("steps.txt")),
        confirmation_tokens: read_lines(&directory.join("confirmations.txt")),
    }
}

fn optional_metadata(value: &str) -> Option<String> {
    (value != "-").then(|| value.to_owned())
}

fn read_lines(path: &Path) -> Vec<String> {
    fs::read_to_string(path)
        .expect("read bridge text file")
        .lines()
        .map(str::to_owned)
        .filter(|line| !line.is_empty())
        .collect()
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
        .expect("src-tauri is nested under repository root")
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
            "vite.milestone-two-native-workflow.config.ts",
        ])
        .current_dir(&repository)
        .output()
        .expect("build Milestone 2 workflow bridge");
    assert!(
        build.status.success(),
        "workflow bridge build failed\nstdout:\n{}\nstderr:\n{}",
        String::from_utf8_lossy(&build.stdout),
        String::from_utf8_lossy(&build.stderr)
    );
    Path::new(env!("CARGO_MANIFEST_DIR")).join("target/milestone-two-native-workflow/bridge.mjs")
}
