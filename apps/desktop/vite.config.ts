import { resolve } from 'node:path';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const OBSERVER_COMMAND_CHANNEL_ENTRY = 'virtual:observer-command-channel-entry';
const DISABLED_OBSERVER_COMMAND_CHANNEL_ENTRY = `\0${OBSERVER_COMMAND_CHANNEL_ENTRY}`;
const ENABLED_OBSERVER_COMMAND_CHANNEL_ENTRY = `${DISABLED_OBSERVER_COMMAND_CHANNEL_ENTRY}:enabled`;

export default defineConfig(({ mode }) => {
  const observerCommandChannelEnabled =
    loadEnv(mode, import.meta.dirname, '').VITE_OBSERVER_COMMAND_CHANNEL === '1';
  return {
    plugins: [observerCommandChannelEntry(observerCommandChannelEnabled), svelte()],
    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
      watch: {
        ignored: ['**/src-tauri/**'],
      },
    },
  };
});

function observerCommandChannelEntry(enabled: boolean): Plugin {
  return {
    name: 'observer-command-channel-compile-time-entry',
    enforce: 'pre',
    resolveId(source) {
      if (source !== OBSERVER_COMMAND_CHANNEL_ENTRY) return undefined;
      return enabled
        ? ENABLED_OBSERVER_COMMAND_CHANNEL_ENTRY
        : DISABLED_OBSERVER_COMMAND_CHANNEL_ENTRY;
    },
    load(id) {
      if (id === DISABLED_OBSERVER_COMMAND_CHANNEL_ENTRY) {
        return [
          'export const OBSERVER_COMMAND_CHANNEL_COMPILED = false;',
          'export async function installObserverCommandChannelBridge() {',
          '  return () => undefined;',
          '}',
        ].join('\n');
      }
      if (id === ENABLED_OBSERVER_COMMAND_CHANNEL_ENTRY) {
        const bridgePath = JSON.stringify(
          resolve(import.meta.dirname, 'src/observer-command-channel-bridge.ts'),
        );
        return [
          'export const OBSERVER_COMMAND_CHANNEL_COMPILED = true;',
          `export { installObserverCommandChannelBridge } from ${bridgePath};`,
        ].join('\n');
      }
      return undefined;
    },
  };
}
