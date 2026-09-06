/** Private bay revision; frozen182 fallback and all streams/payments remain unchanged. */
import { stream } from '../../../issue-164/morphology.mjs';
import { certifyCandidate } from '../../../issue-178/certificates.mjs';
import { constructTemplate as fallbackTemplate } from '../../../issue-182/templates.mjs';
import {
  BALANCED_GUARD_CEILING,
  CERTIFICATE_OPTIONS,
  constructTemplate as baseTemplate,
  controlRecipe,
} from './base-templates.mjs';
export { BALANCED_GUARD_CEILING, CERTIFICATE_OPTIONS, controlRecipe };
export const TEMPLATE_REVISION = 'issue-183-bays-r1';
export const TEMPLATE_LIMIT = 16;
export const EXTENSION_REVISION = 'issue-182-large-primary-r1';
export function constructTemplate(options) {
  const index = options?.templateIndex ?? 0;
  if (Number.isInteger(index) && index >= 0 && index < 12) return baseTemplate(options);
  return fallbackTemplate(options);
}
export function constructOwners(input) {
  let recipe;
  try {
    if (typeof input?.seed !== 'string' || !input.seed) throw new Error('Invalid seed');
    recipe = controlRecipe(input.controls);
  } catch (error) {
    return {
      ok: false,
      owners: [],
      failures: [{ code: 'invalid-input', message: error.message }],
      receipts: [],
    };
  }
  const count = recipe.ownerCount,
    primaryCount = Math.min(count, 1 + Math.floor(stream(input.seed, 'primary-count')() * 3));
  const sizes = Array.from({ length: count }, (_, i) =>
      recipe.distribution === 'balanced'
        ? 0.9
        : recipe.distribution === 'oneDominant'
          ? i === 0
            ? 1
            : 0.55
          : i < primaryCount
            ? 0.95
            : 0.55,
    ),
    sum = sizes.reduce((s, x) => s + x * x, 0),
    owners = [],
    failures = [],
    receipts = [];
  const layoutRotation = Math.floor(stream(input.seed, 'issue-179-r1/layout-order')() * 3);
  let primaryRank = 0,
    subordinateRank = 0;
  for (let i = 0; i < count; i++) {
    const id = `owner-${i}`,
      quota = (recipe.landFraction * sizes[i] ** 2) / sum,
      primary = sizes[i] ** 2 >= Math.max(...sizes) ** 2 * 0.5;
    const layoutPreference = (layoutRotation + (primary ? primaryRank++ : subordinateRank++)) % 3;
    let accepted;
    for (let index = 0; index < TEMPLATE_LIMIT; index++) {
      let candidate, certificate;
      try {
        candidate = constructTemplate({
          id,
          primary,
          quota,
          recipe,
          seed: input.seed,
          templateIndex: index,
          layoutPreference,
        });
        certificate = certifyCandidate(candidate, { quota, ...CERTIFICATE_OPTIONS });
      } catch (error) {
        certificate = {
          ok: false,
          failures: [
            {
              code: 'construction',
              message: error.message,
              ...(error.siteReceipts ? { siteReceipts: error.siteReceipts } : {}),
            },
          ],
        };
      }
      const selectionFailures =
        certificate.ok &&
        recipe.distribution === 'balanced' &&
        count === 6 &&
        certificate.metrics.guardRadius > BALANCED_GUARD_CEILING
          ? [
              {
                code: 'balanced-guard-preference',
                actual: certificate.metrics.guardRadius,
                maximum: BALANCED_GUARD_CEILING,
              },
            ]
          : [];
      const selected = certificate.ok && selectionFailures.length === 0;
      receipts.push({
        ownerId: id,
        quota,
        templateIndex: index,
        layoutPreference,
        layoutIndex: candidate?.layoutIndex,
        ok: selected,
        certificateOk: certificate.ok,
        failures: [...certificate.failures, ...selectionFailures],
      });
      if (selected) {
        accepted = {
          id,
          quota,
          primary,
          size: sizes[i],
          radius: certificate.metrics.guardRadius,
          candidate,
          certificate,
        };
        break;
      }
    }
    if (accepted) owners.push(accepted);
    else
      failures.push({
        code: 'template-budget-exhausted',
        ownerId: id,
        quota,
        candidateCount: TEMPLATE_LIMIT,
      });
  }
  return {
    ok: !failures.length,
    owners,
    failures,
    receipts,
    recipe,
    revision: TEMPLATE_REVISION,
    extension: {
      revision: EXTENSION_REVISION,
      frozenCandidateCount: 12,
      fallbackCandidateCount: 4,
      totalCandidateLimit: TEMPLATE_LIMIT,
    },
  };
}
