use std::io;

use super::adapter_error::{durability_error, io_error, rename_error};
use super::model::{ArtifactRole, NativeError};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FaultMode {
    ErrorBefore,
    TerminateAfter,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct FaultSpec {
    pub point: u8,
    pub occurrence: usize,
    pub mode: FaultMode,
    pub hard_terminate: bool,
    pub os_error_number: Option<i32>,
}

#[derive(Debug, Default)]
pub(crate) struct FaultController {
    spec: Option<FaultSpec>,
    counts: [usize; 18],
}

impl FaultController {
    pub(crate) fn new(spec: Option<FaultSpec>) -> Self {
        Self {
            spec,
            counts: [0; 18],
        }
    }

    pub(crate) fn before(&mut self, point: u8) -> io::Result<()> {
        let occurrence = self.bump(point);
        if self.matches(point, occurrence, FaultMode::ErrorBefore) {
            let number = self.spec.and_then(|spec| spec.os_error_number).unwrap_or(5);
            return Err(io::Error::from_raw_os_error(number));
        }
        Ok(())
    }

    pub(crate) fn after(&self, point: u8, primitive: &'static str) -> Result<(), NativeError> {
        let occurrence = self.counts[usize::from(point)];
        if self.matches(point, occurrence, FaultMode::TerminateAfter) {
            if self.spec.is_some_and(|spec| spec.hard_terminate) {
                std::process::exit(86);
            }
            return Err(NativeError::terminated(point, primitive));
        }
        Ok(())
    }

    fn bump(&mut self, point: u8) -> usize {
        let slot = &mut self.counts[usize::from(point)];
        *slot += 1;
        *slot
    }

    fn matches(&self, point: u8, occurrence: usize, mode: FaultMode) -> bool {
        self.spec.is_some_and(|spec| {
            spec.point == point && spec.occurrence == occurrence && spec.mode == mode
        })
    }
}

pub(crate) fn io_call<T>(
    fault: &mut FaultController,
    point: u8,
    primitive: &'static str,
    role: Option<ArtifactRole>,
    operation: impl FnOnce() -> io::Result<T>,
) -> Result<T, NativeError> {
    let value = fault
        .before(point)
        .and_then(|()| operation())
        .map_err(|error| io_error(primitive, role, error))?;
    fault.after(point, primitive)?;
    Ok(value)
}

pub(crate) fn durability_call<T>(
    fault: &mut FaultController,
    point: u8,
    primitive: &'static str,
    role: Option<ArtifactRole>,
    operation: impl FnOnce() -> io::Result<T>,
) -> Result<T, NativeError> {
    let value = fault
        .before(point)
        .and_then(|()| operation())
        .map_err(|error| durability_error(primitive, role, error))?;
    fault.after(point, primitive)?;
    Ok(value)
}

pub(crate) fn rename_call<T>(
    fault: &mut FaultController,
    point: u8,
    role: ArtifactRole,
    operation: impl FnOnce() -> io::Result<T>,
) -> Result<T, NativeError> {
    let value = fault
        .before(point)
        .and_then(|()| operation())
        .map_err(|error| rename_error(role, error))?;
    fault.after(point, "rename-no-replace")?;
    Ok(value)
}

pub(crate) fn io_checkpoint(
    fault: &mut FaultController,
    point: u8,
    primitive: &'static str,
    role: ArtifactRole,
) -> Result<(), NativeError> {
    fault
        .before(point)
        .map_err(|error| io_error(primitive, Some(role), error))
}
