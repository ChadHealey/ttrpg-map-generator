use std::collections::VecDeque;
use std::sync::{Arc, Condvar, Mutex, MutexGuard};
use std::time::Duration;

use super::error::ObserverError;
use super::protocol::{Frame, ObserverCommand, Session};

struct BridgeState {
    session: Session,
    outgoing: VecDeque<Frame>,
    terminal: bool,
    privacy_values: Vec<String>,
    command_private_values: Vec<String>,
}

struct BridgeInner {
    state: Mutex<BridgeState>,
    changed: Condvar,
}

#[derive(Clone)]
pub(crate) struct ObserverBridge {
    inner: Arc<BridgeInner>,
}

impl ObserverBridge {
    pub(crate) fn new(
        session: [u8; 16],
        capability: [u8; 32],
        privacy_values: Vec<String>,
    ) -> Self {
        Self {
            inner: Arc::new(BridgeInner {
                state: Mutex::new(BridgeState {
                    session: Session::new(session, capability),
                    outgoing: VecDeque::new(),
                    terminal: false,
                    privacy_values,
                    command_private_values: Vec::new(),
                }),
                changed: Condvar::new(),
            }),
        }
    }

    pub(crate) fn authenticate(&self, frame: Frame) -> Result<(), ObserverError> {
        let mut state = self.lock();
        match state.session.authenticate(frame) {
            Ok(()) => Ok(()),
            Err(error) => Err(Self::fail_locked(&mut state, error, 0)),
        }
    }

    pub(crate) fn frontend_ready(&self) -> Result<(), ObserverError> {
        let mut state = self.lock();
        match state.session.frontend_ready() {
            Ok(frame) => {
                state.outgoing.push_back(frame);
                self.inner.changed.notify_all();
                Ok(())
            }
            Err(error) => Err(Self::fail_locked(&mut state, error, 0)),
        }
    }

    pub(crate) fn receive_command(&self, frame: Frame) -> Result<ObserverCommand, ObserverError> {
        let sequence = frame.sequence;
        let mut state = self.lock();
        match state.session.receive_command(frame) {
            Ok(command) => {
                state.command_private_values.clear();
                if command.opcode == 0x1a {
                    state
                        .command_private_values
                        .push(String::from_utf8_lossy(&command.body).into_owned());
                }
                Ok(command)
            }
            Err(error) => Err(Self::fail_locked(&mut state, error, sequence)),
        }
    }

    pub(crate) fn command_started(&self, sequence: u64) -> Result<(), ObserverError> {
        let mut state = self.lock();
        match state.session.command_started(sequence) {
            Ok(frame) => {
                state.outgoing.push_back(frame);
                self.inner.changed.notify_all();
                Ok(())
            }
            Err(error) => Err(Self::fail_locked(&mut state, error, sequence)),
        }
    }

    pub(crate) fn command_completed(
        &self,
        sequence: u64,
        status: u16,
        receipt: &str,
    ) -> Result<(), ObserverError> {
        let mut state = self.lock();
        if receipt_contains_private_value(&state, receipt) {
            return Err(Self::fail_locked(
                &mut state,
                ObserverError::Malformed,
                sequence,
            ));
        }
        match state.session.command_completed(sequence, status, receipt) {
            Ok(frame) => {
                state.command_private_values.clear();
                state.outgoing.push_back(frame);
                self.inner.changed.notify_all();
                Ok(())
            }
            Err(error) => Err(Self::fail_locked(&mut state, error, sequence)),
        }
    }

    pub(crate) fn reject(&self, error: ObserverError, sequence: u64) {
        let mut state = self.lock();
        Self::fail_locked(&mut state, error, sequence);
        self.inner.changed.notify_all();
    }

    pub(crate) fn take_outgoing(&self) -> Option<Frame> {
        self.lock().outgoing.pop_front()
    }

    pub(crate) fn wait_tick(&self, duration: Duration) {
        let state = self.lock();
        drop(
            self.inner
                .changed
                .wait_timeout(state, duration)
                .unwrap_or_else(|poisoned| poisoned.into_inner()),
        );
    }

    pub(crate) fn is_terminal(&self) -> bool {
        self.lock().terminal
    }

    pub(crate) fn abort(&self) {
        let mut state = self.lock();
        state.terminal = true;
        state.session.close();
        state.outgoing.clear();
        state.command_private_values.clear();
        self.inner.changed.notify_all();
    }

    fn fail_locked(state: &mut BridgeState, error: ObserverError, sequence: u64) -> ObserverError {
        if !state.terminal {
            let reject = state.session.reject(error, sequence);
            state.outgoing.clear();
            state.outgoing.push_back(reject);
            state.command_private_values.clear();
            state.terminal = true;
        }
        error
    }

    fn lock(&self) -> MutexGuard<'_, BridgeState> {
        self.inner
            .state
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

fn receipt_contains_private_value(state: &BridgeState, receipt: &str) -> bool {
    state
        .privacy_values
        .iter()
        .chain(&state.command_private_values)
        .any(|value| !value.is_empty() && receipt.contains(value))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::observer_command_channel::protocol::{Kind, ObserverCommand};

    const SESSION: [u8; 16] = [0x51; 16];
    const CAPABILITY: [u8; 32] = [0xa7; 32];

    fn frame(kind: Kind, sequence: u64, body: Vec<u8>) -> Frame {
        Frame {
            kind,
            session: SESSION,
            sequence,
            body,
        }
    }

    fn ready_bridge() -> ObserverBridge {
        let bridge = ObserverBridge::new(
            SESSION,
            CAPABILITY,
            vec![
                "private-capability-value".to_owned(),
                "\"pid\":1234".to_owned(),
                "/private/candidate".to_owned(),
            ],
        );
        bridge
            .authenticate(frame(Kind::Hello, 0, CAPABILITY.to_vec()))
            .expect("hello");
        bridge.frontend_ready().expect("frontend");
        assert_eq!(bridge.take_outgoing().expect("ready").kind, Kind::Ready);
        bridge
    }

    #[test]
    fn lifecycle_queues_ready_started_and_complete_in_order() {
        let bridge = ready_bridge();
        assert_eq!(
            bridge
                .receive_command(frame(Kind::Command, 1, vec![0x11]))
                .expect("command"),
            ObserverCommand {
                sequence: 1,
                opcode: 0x11,
                body: Vec::new(),
            }
        );
        bridge.command_started(1).expect("started");
        assert_eq!(
            bridge.take_outgoing().expect("started frame").kind,
            Kind::Started
        );
        bridge.command_completed(1, 0, "ok").expect("complete");
        assert_eq!(
            bridge.take_outgoing().expect("complete frame").kind,
            Kind::Complete
        );
    }

    #[test]
    fn duplicate_frontend_listener_and_wrong_lifecycle_sequence_are_terminal() {
        let duplicate = ready_bridge();
        assert_eq!(duplicate.frontend_ready(), Err(ObserverError::Lifecycle));
        assert!(duplicate.is_terminal());
        assert_eq!(
            duplicate.take_outgoing().expect("reject").kind,
            Kind::Reject
        );

        let wrong_sequence = ready_bridge();
        wrong_sequence
            .receive_command(frame(Kind::Command, 1, vec![0x11]))
            .expect("command");
        assert_eq!(
            wrong_sequence.command_started(2),
            Err(ObserverError::Lifecycle)
        );
        assert!(wrong_sequence.is_terminal());
    }

    #[test]
    fn receipt_cannot_echo_bootstrap_or_prepare_path_values() {
        let bootstrap = ready_bridge();
        bootstrap
            .receive_command(frame(Kind::Command, 1, vec![0x11]))
            .expect("command");
        bootstrap.command_started(1).expect("started");
        assert_eq!(
            bootstrap.command_completed(1, 0, "private-capability-value"),
            Err(ObserverError::Malformed)
        );

        let pid = ready_bridge();
        pid.receive_command(frame(Kind::Command, 1, vec![0x11]))
            .expect("command");
        pid.command_started(1).expect("started");
        assert_eq!(
            pid.command_completed(1, 0, "{\"pid\":1234}"),
            Err(ObserverError::Malformed)
        );

        let executable = ready_bridge();
        executable
            .receive_command(frame(Kind::Command, 1, vec![0x11]))
            .expect("command");
        executable.command_started(1).expect("started");
        assert_eq!(
            executable.command_completed(1, 0, "/private/candidate"),
            Err(ObserverError::Malformed)
        );

        let prepare = ready_bridge();
        let path = "/private/tmp/private-atlas.mapworld";
        let mut body = vec![0x1a];
        body.extend_from_slice(path.as_bytes());
        prepare
            .receive_command(frame(Kind::Command, 1, body))
            .expect("prepare");
        prepare.command_started(1).expect("started");
        assert_eq!(
            prepare.command_completed(1, 0, path),
            Err(ObserverError::Malformed)
        );
    }

    #[test]
    fn teardown_discards_queued_success_and_closes_the_bridge() {
        let bridge = ready_bridge();
        bridge
            .receive_command(frame(Kind::Command, 1, vec![0x11]))
            .expect("command");
        bridge.command_started(1).expect("started");
        bridge.abort();
        assert!(bridge.is_terminal());
        assert!(bridge.take_outgoing().is_none());
        assert_eq!(
            bridge.command_completed(1, 0, "ok"),
            Err(ObserverError::Lifecycle)
        );
    }
}
