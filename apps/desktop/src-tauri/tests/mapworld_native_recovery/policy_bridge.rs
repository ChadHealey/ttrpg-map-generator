use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};

use ttrpg_map_desktop_lib::mapworld_native::service::{
    NativeSaveRequest, apply_recovery_plan, snapshot_target,
};
use ttrpg_map_desktop_lib::mapworld_native::{
    ArtifactRole, NativeSelectedCandidate, NativeSnapshot, ObservationKind,
};

use super::support::observation_matches;

pub(crate) struct PolicyBridge {
    child: Child,
    input: ChildStdin,
    output: BufReader<ChildStdout>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct PolicyDecision {
    kind: String,
    code: Option<String>,
    selected_role: Option<ArtifactRole>,
    selected_fingerprint: Option<String>,
    selected_observation_token: Option<String>,
    steps: Vec<String>,
    confirmations: Vec<String>,
}

impl PolicyBridge {
    pub(crate) fn spawn() -> Self {
        let repository = repository_root();
        let build = Command::new("corepack")
            .args([
                "pnpm",
                "--filter",
                "@ttrpg-map/desktop",
                "exec",
                "vite",
                "build",
                "--config",
                "vite.mapworld-recovery-policy.config.ts",
            ])
            .current_dir(&repository)
            .output()
            .expect("build the test-only persistence policy bridge");
        assert!(
            build.status.success(),
            "policy bridge build failed\nstdout:\n{}\nstderr:\n{}",
            String::from_utf8_lossy(&build.stdout),
            String::from_utf8_lossy(&build.stderr)
        );
        let bridge_path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("target/mapworld-recovery-policy-bridge/bridge.mjs");
        let mut child = Command::new("node")
            .arg(bridge_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .expect("start persistence policy bridge");
        let input = child.stdin.take().expect("bridge stdin");
        let output = BufReader::new(child.stdout.take().expect("bridge stdout"));
        Self {
            child,
            input,
            output,
        }
    }

    fn decide(&mut self, snapshot: &NativeSnapshot) -> PolicyDecision {
        writeln!(self.input, "{}", snapshot.success_json()).expect("write native snapshot");
        self.input.flush().expect("flush native snapshot");
        let mut response = String::new();
        self.output
            .read_line(&mut response)
            .expect("read persistence decision");
        assert!(
            !response.is_empty(),
            "policy bridge ended without a decision"
        );
        parse_decision(response.trim_end_matches(['\r', '\n']))
    }

    pub(crate) fn recover_with_policy(
        &mut self,
        target: &Path,
        previous: Option<&NativeSaveRequest>,
        candidate: &NativeSaveRequest,
        point: u8,
    ) -> PolicyTerminal {
        let target_text = target.to_str().expect("UTF-8 target");
        let mut snapshot = snapshot_target(target_text).expect("enumerate interrupted state");
        for _pass in 0..8 {
            let decision = self.decide(&snapshot);
            assert_eq!(
                decision,
                self.decide(&snapshot),
                "pure policy drifted for P{point:02}"
            );
            assert_selected_identity(&snapshot, &decision, previous, candidate);
            match decision.kind.as_str() {
                "apply" => {
                    assert!(decision.code.is_none());
                    assert!(
                        decision.confirmations.is_empty(),
                        "automatic policy plan cannot fabricate confirmation"
                    );
                    let selected_candidate = selected_candidate(&decision);
                    snapshot = apply_recovery_plan(
                        target_text,
                        &snapshot.snapshot_id,
                        &decision.steps,
                        &decision.confirmations,
                        selected_candidate.as_ref(),
                    )
                    .expect("apply exact persistence-owned recovery plan");
                }
                "attention" | "clean" => {
                    assert_eq!(decision.code.is_some(), decision.kind == "attention");
                    assert_eq!(
                        snapshot,
                        snapshot_target(target_text).expect("repeat terminal enumeration"),
                        "terminal policy state changed during P{point:02} reopen"
                    );
                    return PolicyTerminal {
                        kind: decision.kind,
                        selected_fingerprint: decision.selected_fingerprint,
                        snapshot,
                    };
                }
                kind => panic!("policy bridge returned unexpected decision kind: {kind}"),
            }
        }
        panic!("persistence policy did not converge for P{point:02}");
    }
}

impl Drop for PolicyBridge {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

pub(crate) struct PolicyTerminal {
    pub(crate) kind: String,
    pub(crate) selected_fingerprint: Option<String>,
    pub(crate) snapshot: NativeSnapshot,
}

fn parse_decision(line: &str) -> PolicyDecision {
    let fields = line.split('\t').collect::<Vec<_>>();
    assert_eq!(fields.len(), 7, "malformed policy bridge response: {line}");
    assert_ne!(
        fields[0], "error",
        "persistence rejected native DTO: {line}"
    );
    PolicyDecision {
        kind: fields[0].to_owned(),
        code: optional_field(fields[1]),
        selected_role: optional_field(fields[2]).map(|role| {
            ArtifactRole::parse(&role).unwrap_or_else(|| panic!("invalid selected role: {role}"))
        }),
        selected_fingerprint: optional_field(fields[3]),
        selected_observation_token: optional_field(fields[4]),
        steps: list_field(fields[5]),
        confirmations: list_field(fields[6]),
    }
}

fn optional_field(value: &str) -> Option<String> {
    (value != "-").then(|| value.to_owned())
}

fn list_field(value: &str) -> Vec<String> {
    if value.is_empty() {
        Vec::new()
    } else {
        value.split(',').map(str::to_owned).collect()
    }
}

fn assert_selected_identity(
    snapshot: &NativeSnapshot,
    decision: &PolicyDecision,
    previous: Option<&NativeSaveRequest>,
    candidate: &NativeSaveRequest,
) {
    let Some(role) = decision.selected_role else {
        assert!(decision.selected_fingerprint.is_none());
        assert!(decision.selected_observation_token.is_none());
        return;
    };
    let fingerprint = decision
        .selected_fingerprint
        .as_deref()
        .expect("selected decoded package has a fingerprint");
    let observation = snapshot.observation(role);
    assert_eq!(
        decision.selected_observation_token.as_deref(),
        Some(observation.observation_token.as_str())
    );
    if fingerprint == candidate.candidate_manifest_sha256 {
        assert!(observation_matches(observation, candidate));
    } else if let Some(old) = previous {
        assert_eq!(fingerprint, old.candidate_manifest_sha256);
        assert!(observation_matches(observation, old));
    } else {
        panic!("persistence selected an unknown package fingerprint: {fingerprint}");
    }
    assert!(matches!(observation.kind, ObservationKind::Directory(_)));
}

fn selected_candidate(decision: &PolicyDecision) -> Option<NativeSelectedCandidate> {
    Some(NativeSelectedCandidate {
        role: decision.selected_role?.as_str().to_owned(),
        observation_token: decision.selected_observation_token.clone()?,
        manifest_sha256: decision.selected_fingerprint.clone()?,
    })
}

fn repository_root() -> std::path::PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .ancestors()
        .nth(3)
        .expect("src-tauri is nested under the repository root")
        .to_path_buf()
}
