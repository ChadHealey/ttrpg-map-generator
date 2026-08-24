import Foundation

struct Issue105TargetSessionReadinessQualificationReceipt: Codable {
  let controllerVersion: String
  let status: String
  let qualificationKind: String
  let target: Issue100TargetReceipt
  let sessionMechanism: String?
  let bundleIdentifier: String?
  let candidateExecutableSha256: String?
  let controllerSha256: String?
  let readinessObserverSha256: String?
  let predicates: Issue100ReadinessPredicates?
  let stabilization: Issue105StabilizationDiagnostics?
  let zeroOperationProof: Issue100ZeroOperationReceipt
  let invalidAuthority: String?
  let invalidReason: String?

  static func invalid(
    _ invalidation: TargetSessionReadinessInvalidation,
    diagnostics: Issue105StabilizationDiagnostics? = nil
  ) -> Self {
    Issue105TargetSessionReadinessQualificationReceipt(
      controllerVersion: issue105ReadinessSchemaVersion,
      status: "invalid",
      qualificationKind: "non-measurement-target-session-readiness",
      target: .approved,
      sessionMechanism: nil,
      bundleIdentifier: nil,
      candidateExecutableSha256: nil,
      controllerSha256: nil,
      readinessObserverSha256: nil,
      predicates: nil,
      stabilization: diagnostics,
      zeroOperationProof: .zero,
      invalidAuthority: invalidation.authority,
      invalidReason: invalidation.description
    )
  }
}
