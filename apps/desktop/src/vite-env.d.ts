declare module 'virtual:observer-command-channel-entry' {
  import type { ObserverCommandAuthorities } from './observer-command-channel-bridge.js';

  export const OBSERVER_COMMAND_CHANNEL_COMPILED: boolean;
  export function installObserverCommandChannelBridge(
    authorities: ObserverCommandAuthorities,
    isMounted: () => boolean,
  ): Promise<() => void>;
}
