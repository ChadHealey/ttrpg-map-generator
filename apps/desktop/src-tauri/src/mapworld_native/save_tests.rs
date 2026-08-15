use std::io::{self, Write};

use super::fault::FaultController;
use super::model::ArtifactRole;
use super::save_support::write_all_partial;

#[derive(Default)]
struct InterruptedPartialWriter {
    bytes: Vec<u8>,
    calls: usize,
}

struct EnospcWriter;

impl Write for EnospcWriter {
    fn write(&mut self, _bytes: &[u8]) -> io::Result<usize> {
        Err(io::Error::from_raw_os_error(28))
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

impl Write for InterruptedPartialWriter {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.calls += 1;
        if self.calls == 1 {
            return Err(io::Error::from(io::ErrorKind::Interrupted));
        }
        let count = bytes.len().min(2);
        self.bytes.extend_from_slice(&bytes[..count]);
        Ok(count)
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

#[test]
fn retries_eintr_and_completes_partial_writes_exactly() {
    let mut writer = InterruptedPartialWriter::default();
    let mut fault = FaultController::new(None);
    write_all_partial(
        &mut writer,
        b"abcdef",
        5,
        "test-write",
        ArtifactRole::Temporary,
        &mut fault,
    )
    .expect("partial writer completes");
    assert_eq!(writer.bytes, b"abcdef");
    assert_eq!(writer.calls, 4);
}

#[test]
fn preserves_enospc_context_from_the_write_loop() {
    let mut writer = EnospcWriter;
    let mut fault = FaultController::new(None);
    let error = write_all_partial(
        &mut writer,
        b"bytes",
        5,
        "write-test",
        ArtifactRole::Temporary,
        &mut fault,
    )
    .expect_err("ENOSPC fails the write");
    assert_eq!(error.code, "persistence.recovery.io-failed");
    assert_eq!(error.primitive, "write-test");
    assert_eq!(error.os_error_number, Some(28));
    assert_eq!(error.os_error_name.as_deref(), Some("ENOSPC"));
    assert_eq!(error.role, Some(ArtifactRole::Temporary));
}
