use std::io::{self, Read};

use super::error::ObserverError;

const MAGIC: [u8; 4] = *b"TMOC";
const VERSION: u16 = 1;
pub(crate) const FIXED_PAYLOAD_BYTES: usize = 32;
pub(crate) const MAX_PAYLOAD_BYTES: usize = 65_536;
const MAX_PREPARE_PATH_BYTES: usize = 1_024;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u8)]
pub(crate) enum Kind {
    Hello = 1,
    Ready = 2,
    Command = 3,
    Started = 4,
    Complete = 5,
    Reject = 6,
}

impl TryFrom<u8> for Kind {
    type Error = ObserverError;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            1 => Ok(Self::Hello),
            2 => Ok(Self::Ready),
            3 => Ok(Self::Command),
            4 => Ok(Self::Started),
            5 => Ok(Self::Complete),
            6 => Ok(Self::Reject),
            _ => Err(ObserverError::Malformed),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct Frame {
    pub(crate) kind: Kind,
    pub(crate) session: [u8; 16],
    pub(crate) sequence: u64,
    pub(crate) body: Vec<u8>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct ObserverCommand {
    pub(crate) sequence: u64,
    pub(crate) opcode: u8,
    pub(crate) body: Vec<u8>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum SessionState {
    AwaitingHello,
    AwaitingFrontend,
    Ready { next_sequence: u64 },
    AwaitingStarted { sequence: u64 },
    AwaitingCompletion { sequence: u64 },
    Closed,
}

pub(crate) struct Session {
    expected_session: [u8; 16],
    expected_capability: [u8; 32],
    state: SessionState,
}

impl Session {
    pub(crate) fn new(expected_session: [u8; 16], expected_capability: [u8; 32]) -> Self {
        Self {
            expected_session,
            expected_capability,
            state: SessionState::AwaitingHello,
        }
    }

    pub(crate) fn authenticate(&mut self, frame: Frame) -> Result<(), ObserverError> {
        if self.state != SessionState::AwaitingHello {
            return self.fail(ObserverError::Lifecycle);
        }
        if frame.kind != Kind::Hello
            || frame.sequence != 0
            || frame.session != self.expected_session
            || !constant_time_equal(&frame.body, &self.expected_capability)
        {
            return self.fail(ObserverError::Unauthorized);
        }
        self.state = SessionState::AwaitingFrontend;
        Ok(())
    }

    pub(crate) fn frontend_ready(&mut self) -> Result<Frame, ObserverError> {
        if self.state != SessionState::AwaitingFrontend {
            return self.fail(ObserverError::Lifecycle);
        }
        self.state = SessionState::Ready { next_sequence: 1 };
        Ok(self.frame(Kind::Ready, 0, Vec::new()))
    }

    pub(crate) fn receive_command(
        &mut self,
        frame: Frame,
    ) -> Result<ObserverCommand, ObserverError> {
        let SessionState::Ready { next_sequence } = self.state else {
            let error = match self.state {
                SessionState::AwaitingStarted { .. } | SessionState::AwaitingCompletion { .. } => {
                    ObserverError::Busy
                }
                SessionState::Closed => ObserverError::Lifecycle,
                _ => ObserverError::Lifecycle,
            };
            return self.fail(error);
        };
        if frame.kind != Kind::Command {
            return self.fail(ObserverError::Malformed);
        }
        if frame.session != self.expected_session {
            return self.fail(ObserverError::Unauthorized);
        }
        if frame.sequence < next_sequence {
            return self.fail(ObserverError::Sequence);
        }
        if frame.sequence != next_sequence {
            return self.fail(ObserverError::Sequence);
        }
        let (opcode, body) = validate_command(&frame.body).inspect_err(|_| {
            self.state = SessionState::Closed;
        })?;
        self.state = SessionState::AwaitingStarted {
            sequence: frame.sequence,
        };
        Ok(ObserverCommand {
            sequence: frame.sequence,
            opcode,
            body,
        })
    }

    pub(crate) fn command_started(&mut self, sequence: u64) -> Result<Frame, ObserverError> {
        if self.state != (SessionState::AwaitingStarted { sequence }) {
            return self.fail(ObserverError::Lifecycle);
        }
        self.state = SessionState::AwaitingCompletion { sequence };
        Ok(self.frame(Kind::Started, sequence, Vec::new()))
    }

    pub(crate) fn command_completed(
        &mut self,
        sequence: u64,
        status: u16,
        receipt: &str,
    ) -> Result<Frame, ObserverError> {
        if self.state != (SessionState::AwaitingCompletion { sequence }) {
            return self.fail(ObserverError::Lifecycle);
        }
        if status > 4 || FIXED_PAYLOAD_BYTES + 6 + receipt.len() > MAX_PAYLOAD_BYTES {
            return self.fail(ObserverError::Framing);
        }
        if status != 0 && !stable_diagnostic(receipt) {
            return self.fail(ObserverError::Malformed);
        }
        let receipt_length = u32::try_from(receipt.len()).map_err(|_| ObserverError::Framing)?;
        let mut body = Vec::with_capacity(6 + receipt.len());
        body.extend_from_slice(&status.to_be_bytes());
        body.extend_from_slice(&receipt_length.to_be_bytes());
        body.extend_from_slice(receipt.as_bytes());
        self.state = SessionState::Ready {
            next_sequence: sequence.checked_add(1).ok_or(ObserverError::Sequence)?,
        };
        Ok(self.frame(Kind::Complete, sequence, body))
    }

    pub(crate) fn reject(&mut self, error: ObserverError, sequence: u64) -> Frame {
        self.state = SessionState::Closed;
        self.frame(
            Kind::Reject,
            sequence,
            error.reject_reason().to_be_bytes().to_vec(),
        )
    }

    pub(crate) fn close(&mut self) {
        self.state = SessionState::Closed;
    }

    fn frame(&self, kind: Kind, sequence: u64, body: Vec<u8>) -> Frame {
        Frame {
            kind,
            session: self.expected_session,
            sequence,
            body,
        }
    }

    fn fail<T>(&mut self, error: ObserverError) -> Result<T, ObserverError> {
        self.state = SessionState::Closed;
        Err(error)
    }
}

pub(crate) fn encode(frame: &Frame) -> Result<Vec<u8>, ObserverError> {
    let payload_length = FIXED_PAYLOAD_BYTES
        .checked_add(frame.body.len())
        .ok_or(ObserverError::Framing)?;
    if !(FIXED_PAYLOAD_BYTES..=MAX_PAYLOAD_BYTES).contains(&payload_length) {
        return Err(ObserverError::Framing);
    }
    let payload_length = u32::try_from(payload_length).map_err(|_| ObserverError::Framing)?;
    let mut encoded = Vec::with_capacity(4 + payload_length as usize);
    encoded.extend_from_slice(&payload_length.to_be_bytes());
    encoded.extend_from_slice(&MAGIC);
    encoded.extend_from_slice(&VERSION.to_be_bytes());
    encoded.push(frame.kind as u8);
    encoded.push(0);
    encoded.extend_from_slice(&frame.session);
    encoded.extend_from_slice(&frame.sequence.to_be_bytes());
    encoded.extend_from_slice(&frame.body);
    Ok(encoded)
}

pub(crate) fn decode(reader: &mut impl Read) -> Result<Frame, ObserverError> {
    let mut length_bytes = [0_u8; 4];
    reader
        .read_exact(&mut length_bytes)
        .map_err(classify_read_error)?;
    let length = u32::from_be_bytes(length_bytes) as usize;
    if !(FIXED_PAYLOAD_BYTES..=MAX_PAYLOAD_BYTES).contains(&length) {
        return Err(ObserverError::Framing);
    }
    let mut payload = vec![0_u8; length];
    reader
        .read_exact(&mut payload)
        .map_err(classify_read_error)?;
    decode_payload(&payload)
}

pub(crate) struct FrameReader {
    bytes: Vec<u8>,
}

impl FrameReader {
    pub(crate) fn new() -> Self {
        Self { bytes: Vec::new() }
    }

    pub(crate) fn poll(&mut self, reader: &mut impl Read) -> Result<Option<Frame>, ObserverError> {
        let mut chunk = [0_u8; 4_096];
        match reader.read(&mut chunk) {
            Ok(0) => return Err(ObserverError::Disconnect),
            Ok(count) => self.bytes.extend_from_slice(&chunk[..count]),
            Err(error)
                if matches!(
                    error.kind(),
                    io::ErrorKind::WouldBlock | io::ErrorKind::TimedOut
                ) => {}
            Err(_) => return Err(ObserverError::Io),
        }
        if self.bytes.len() < 4 {
            return Ok(None);
        }
        let length =
            u32::from_be_bytes(self.bytes[..4].try_into().expect("four-byte prefix")) as usize;
        if !(FIXED_PAYLOAD_BYTES..=MAX_PAYLOAD_BYTES).contains(&length) {
            return Err(ObserverError::Framing);
        }
        let frame_length = 4 + length;
        if self.bytes.len() < frame_length {
            return Ok(None);
        }
        let frame = decode_payload(&self.bytes[4..frame_length])?;
        self.bytes.drain(..frame_length);
        Ok(Some(frame))
    }
}

fn decode_payload(payload: &[u8]) -> Result<Frame, ObserverError> {
    if payload[0..4] != MAGIC {
        return Err(ObserverError::Malformed);
    }
    if u16::from_be_bytes([payload[4], payload[5]]) != VERSION {
        return Err(ObserverError::Version);
    }
    if payload[7] != 0 {
        return Err(ObserverError::Malformed);
    }
    let kind = Kind::try_from(payload[6])?;
    let mut session = [0_u8; 16];
    session.copy_from_slice(&payload[8..24]);
    let sequence = u64::from_be_bytes(payload[24..32].try_into().expect("eight-byte sequence"));
    Ok(Frame {
        kind,
        session,
        sequence,
        body: payload[32..].to_vec(),
    })
}

fn validate_command(body: &[u8]) -> Result<(u8, Vec<u8>), ObserverError> {
    let Some((&opcode, payload)) = body.split_first() else {
        return Err(ObserverError::Malformed);
    };
    match opcode {
        0x10 if payload.len() == 1 && payload[0] <= 2 => Ok((opcode, payload.to_vec())),
        0x10 => Err(ObserverError::Malformed),
        0x11..=0x19 | 0x1b..=0x1c if payload.is_empty() => Ok((opcode, Vec::new())),
        0x11..=0x19 | 0x1b..=0x1c => Err(ObserverError::Malformed),
        0x1a => {
            let path = std::str::from_utf8(payload).map_err(|_| ObserverError::Malformed)?;
            if path.starts_with('/')
                && path.ends_with(".mapworld")
                && !path.contains('\0')
                && path.len() <= MAX_PREPARE_PATH_BYTES
            {
                Ok((opcode, payload.to_vec()))
            } else {
                Err(ObserverError::Malformed)
            }
        }
        _ => Err(ObserverError::Unsupported),
    }
}

fn stable_diagnostic(receipt: &str) -> bool {
    receipt.starts_with("observer.")
        && receipt.len() <= 96
        && receipt
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || b".-".contains(&byte))
}

fn constant_time_equal(left: &[u8], right: &[u8]) -> bool {
    let mut difference = left.len() ^ right.len();
    let maximum = left.len().max(right.len());
    for index in 0..maximum {
        let left = left.get(index).copied().unwrap_or(0);
        let right = right.get(index).copied().unwrap_or(0);
        difference |= usize::from(left ^ right);
    }
    difference == 0
}

fn classify_read_error(error: io::Error) -> ObserverError {
    match error.kind() {
        io::ErrorKind::UnexpectedEof | io::ErrorKind::ConnectionReset => ObserverError::Disconnect,
        io::ErrorKind::TimedOut | io::ErrorKind::WouldBlock => ObserverError::Timeout,
        _ => ObserverError::Io,
    }
}

#[cfg(test)]
#[path = "protocol_tests.rs"]
mod tests;
