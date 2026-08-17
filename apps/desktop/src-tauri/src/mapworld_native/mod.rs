mod adapter_error;
pub mod atlas_svg;
mod base64;
mod fault;
mod filesystem;
mod identity;
mod invalid_tree;
mod model;
mod parent_scan;
mod platform_ffi;
mod recovery;
mod recovery_durability;
mod recovery_input;
#[cfg(test)]
mod recovery_tests;
mod recovery_validation;
mod save;
mod save_plan;
mod save_support;
#[cfg(test)]
mod save_tests;
pub mod service;
mod sha256;

pub use fault::{FaultMode, FaultSpec};
pub use model::{
    ArtifactObservation, ArtifactRole, NativeError, NativeFileEntry, NativeSelectedCandidate,
    NativeSnapshot, ObservationKind,
};
pub use service::{
    mapworld_native_apply, mapworld_native_save, mapworld_native_save_base64,
    mapworld_native_snapshot,
};

pub const NATIVE_MAX_PACKAGE_FILES: usize = 256;
pub const NATIVE_MAX_CLEANUP_ENTRIES: usize = 512;
pub const NATIVE_MAX_PARENT_ENTRIES: usize = 4_096;
pub const NATIVE_MAX_FILE_BYTES: usize = 134_217_728;
pub const NATIVE_MAX_PACKAGE_BYTES: usize = 201_326_592;
pub const NATIVE_MAX_DIRECTORY_DEPTH: usize = 8;
pub const NATIVE_MAX_RELATIVE_PATH_BYTES: usize = 1024;
pub const NATIVE_MAX_MARKER_BYTES: usize = 65_536;
pub const NATIVE_MAX_RECOVERY_STEPS: usize = 64;
pub const NATIVE_MAX_RECOVERY_STEP_BYTES: usize = 64;
pub const NATIVE_MAX_CONFIRMATION_TOKENS: usize = 4;
pub const NATIVE_MAX_CONFIRMATION_TOKEN_BYTES: usize = 160;
pub const NATIVE_MAX_BASENAME_BYTES: usize = 255;
