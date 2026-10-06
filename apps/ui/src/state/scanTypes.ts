/**
 * UI mirrors of the issue-9 scan DTOs (DirectoryScanProgress, SelectedFileReport,
 * SelectedDirectoryReport, ScanReportFinding). Verbatim field-for-field copies of
 * Codex's generated ts-rs outputs on codex/issue-9-scan-progress, local only until
 * that contracts PR merges — then swap these for @sentinel/contracts imports.
 *
 * Contract rules honored here (docs/handoffs/scan-progress.md):
 * - u64 counters travel as canonical unsigned decimal STRINGS; display as text,
 *   never Number(…). The decoder rejects numeric JSON, signs and leading zeros.
 * - progress snapshots are observations, not coverage; `finished` is not
 *   protection; gaps (cancelled / limitReached / traversalComplete=false /
 *   accessErrors / skips) mean incomplete and must never read as clean.
 */

export type DirectoryScanStage = "running" | "finished";

export interface DirectoryScanProgress {
  stage: DirectoryScanStage;
  entriesVisited: string;
  filesVisited: string;
  filesChecked: string;
  filesSkipped: string;
  accessErrors: string;
  engineFailures: string;
  bytesRead: string;
  traversalComplete: boolean;
  cancelled: boolean;
  limitReached: boolean;
}

export type FileScanOutcome =
  | "no_known_finding"
  | "test_signature_found"
  | "skipped_limit"
  | "skipped_unsupported"
  | "access_error"
  | "changed_during_scan"
  | "cancelled";

export type ScanReportCoverage = "partial";

export interface ScanReportFinding {
  findingRef: string;
  state: FileScanOutcome;
}

export interface SelectedFileReport {
  jobId: string;
  selectionRef: string;
  state: FileScanOutcome;
  coverage: ScanReportCoverage;
  bytesRead: string;
  sha256: string | null;
  filesVisited: string;
  filesChecked: string;
  filesSkipped: string;
  accessErrors: string;
  engineFailures: string;
  fullSignatureEngineActive: boolean;
}

export interface SelectedDirectoryReport {
  jobId: string;
  selectionRef: string;
  progress: DirectoryScanProgress;
  coverage: ScanReportCoverage;
  fullSignatureEngineActive: boolean;
  findings: ScanReportFinding[];
  findingsOmitted: string;
}

export type ScanReport = SelectedFileReport | SelectedDirectoryReport;

const COUNTER_KEYS = [
  "entriesVisited",
  "filesVisited",
  "filesChecked",
  "filesSkipped",
  "accessErrors",
  "engineFailures",
  "bytesRead",
] as const;

function isDecimalString(value: unknown): value is string {
  // Canonical unsigned decimal: digits only, no sign, no leading zeros
  // (single "0" allowed). Matches the contract's decoder rejections.
  return typeof value === "string" && /^(0|[1-9][0-9]{0,19})$/.test(value);
}

export function isDirectoryScanProgress(raw: unknown): raw is DirectoryScanProgress {
  if (typeof raw !== "object" || raw === null) return false;
  const p = raw as Record<string, unknown>;
  if (p.stage !== "running" && p.stage !== "finished") return false;
  for (const key of COUNTER_KEYS) {
    if (!isDecimalString(p[key])) return false;
  }
  return (
    typeof p.traversalComplete === "boolean" &&
    typeof p.cancelled === "boolean" &&
    typeof p.limitReached === "boolean"
  );
}
