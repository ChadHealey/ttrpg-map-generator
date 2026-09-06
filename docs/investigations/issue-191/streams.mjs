/** Private SHA-256 counter scopes, structurally following issue 185 (not released RNG v1). */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
export function streams(seed) {
  const ledger = [];
  const used = new Set();
  return {
    ledger,
    stream(suffix, limit) {
      const scope = `worldTerrain.macroElevation.v3.issue191.${suffix}`;
      assert(!used.has(scope), `Scope restarted: ${scope}`);
      used.add(scope);
      const entry = { scope, limit, draws: 0 };
      ledger.push(entry);
      return () => {
        assert(entry.draws < limit, `Draw budget exceeded: ${scope}`);
        return (
          createHash('sha256')
            .update(JSON.stringify([seed, scope, entry.draws++]))
            .digest()
            .readUInt32BE(0) /
          2 ** 32
        );
      };
    },
  };
}
