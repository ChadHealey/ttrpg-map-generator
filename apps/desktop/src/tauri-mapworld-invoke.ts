/** Production adapter from Tauri's invoke API to the validated desktop native boundary. */

import { invoke } from '@tauri-apps/api/core';

import type { NativeMapworldInvoke } from './mapworld-native-boundary.js';

export const tauriMapworldInvoke: NativeMapworldInvoke = (command, arguments_) =>
  invoke(command, arguments_);
