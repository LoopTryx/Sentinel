import { useRef, useState } from "react";
import Icon from "../components/Icon";
import {
  rehearsalScanSource,
  unavailableScanSource,
  type ScanEvent,
  type ScanSelection,
  type ScanSource,
} from "../state/scanSource";
import {
  isDirectoryScanProgress,
  type DirectoryScanProgress,
  type FileScanOutcome,
  type ScanReport,
} from "../state/scanTypes";

const OUTCOME_LABEL: Record<FileScanOutcome, { text: string; kind: "ok" | "warn" | "danger" | "unknown" }> = {
  no_known_finding: { text: "Checked — no known finding", kind: "ok" },
  test_signature_found: { text: "Test signature found", kind: "danger" },
  skipped_limit: { text: "Skipped — bound reached", kind: "unknown" },
  skipped_unsupported: { text: "Skipped — unsupported", kind: "unknown" },
  access_error: { text: "Access error", kind: "warn" },
  changed_during_scan: { text: "Changed during scan", kind: "warn" },
  cancelled: { text: "Cancelled", kind: "unknown" },
};

function OutcomeBadge({ state }: { state: FileScanOutcome }) {
  const { text, kind } = OUTCOME_LABEL[state];
  return (
    <span className={`badge ${kind}`} data-kind={kind}>
      {text}
    </span>
  );
}

const COUNTERS: Array<{ key: keyof DirectoryScanProgress; label: string }> = [
  { key: "entriesVisited", label: "Entries visited" },
  { key: "filesVisited", label: "Files visited" },
  { key: "filesChecked", label: "Files checked" },
  { key: "filesSkipped", label: "Files skipped" },
  { key: "accessErrors", label: "Access errors" },
  { key: "engineFailures", label: "Engine failures" },
  { key: "bytesRead", label: "Bytes read" },
];

/**
 * Scan & Detect center, consuming the issue-9 typed progress/report contract
 * (docs/handoffs/scan-progress.md). Honesty rules enforced here:
 * - running shows indeterminate activity only — never a fabricated percent;
 * - u64 counters render as the decimal STRINGS the DTO carries;
 * - any gap (cancelled / limitReached / traversalComplete=false / skips /
 *   access errors) renders incomplete and never a protection claim;
 * - the full signature engine is inactive, so no green shield exists here.
 * The real adapter slot stays unavailable until Codex's selection/job wrapper
 * lands; the rehearsal replays recorded benign scans and is always labeled.
 */
export default function ScanView() {
  const [scope, setScope] = useState<ScanSelection["kind"]>("directory");
  const [selectionLabel, setSelectionLabel] = useState("demo-projects");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<DirectoryScanProgress | null>(null);
  const [report, setReport] = useState<ScanReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rehearsal, setRehearsal] = useState(false);
  const startRef = useRef<ScanSource | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  const source: ScanSource = rehearsal ? rehearsalScanSource() : unavailableScanSource(
    "The reviewed scanner adapter is not connected in this preview.",
  );

  async function startScan() {
    if (running) return; // repeated-selection guard
    setError(null);
    setReport(null);
    setProgress(null);
    setRunning(true);
    startRef.current = source;
    // Move focus to Cancel (keyboard journey) once the run starts.
    requestAnimationFrame(() => cancelRef.current?.focus());
    try {
      await source.start({ kind: scope, label: selectionLabel }, (event: ScanEvent) => {
        if (event.type === "progress" && isDirectoryScanProgress(event.progress)) {
          setProgress(event.progress);
        } else if (event.type === "report") {
          setReport(event.report);
          if ("progress" in event.report) setProgress(event.report.progress);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "The scan could not start.");
    } finally {
      setRunning(false);
      startRef.current = null;
    }
  }

  function cancelScan() {
    startRef.current?.cancel();
  }

  const hasGaps =
    progress !== null &&
    (progress.cancelled ||
      progress.limitReached ||
      !progress.traversalComplete ||
      progress.accessErrors !== "0" ||
      progress.filesSkipped !== "0" ||
      progress.engineFailures !== "0");

  return (
    <>
      <section className="panel">
        <h3 className="panel-title">SCAN ADAPTER</h3>
        <div className="badge warn" style={{ borderColor: "rgba(255,196,107,0.45)", color: "var(--warn)" }}>
          Partial coverage · engine inactive · not a protection result
        </div>
        <p style={{ color: "var(--text-dim)", fontSize: 13.5, lineHeight: 1.6, margin: "12px 0" }}>
          The reviewed scanner adapter (issue #9 / #19) is not connected to this
          console yet, so this page cannot inspect this device. The{" "}
          <b style={{ color: "var(--text)" }}>rehearsal mode</b> below replays
          recorded benign scan sequences shaped exactly like the typed progress
          contract, to exercise the real journeys — running, gaps, cancellation
          and errors — before the adapter lands.
        </p>
        <label className="switch-row" style={{ paddingInline: 0 }}>
          <div>
            <strong style={{ color: "var(--text)" }}>Rehearsal mode</strong>
            <p>Recorded benign scans · labeled, never presented as a real device scan. Engine coverage is partial and the full signature engine is inactive — this page never renders a protection shield from a scan result.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={rehearsal}
            className={`btn ${rehearsal ? "" : "ghost"}`}
            onClick={() => {
              if (running) return;
              setRehearsal(!rehearsal);
              setProgress(null);
              setReport(null);
              setError(null);
            }}
          >
            {rehearsal ? "On" : "Off"}
          </button>
        </label>
      </section>

      <section className="panel">
        <h3 className="panel-title">SELECTED SCAN</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "12px 0" }}>
          {(
            [
              ["directory", "Selected folder"],
              ["file", "Selected file"],
            ] as const
          ).map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              className={`btn ${scope === kind ? "" : "ghost"}`}
              aria-pressed={scope === kind}
              disabled={running}
              onClick={() => setScope(kind)}
            >
              <Icon name={kind === "file" ? "file" : "folder"} size={14} />
              {label}
            </button>
          ))}
        </div>
        <label style={{ display: "grid", gap: 6, margin: "12px 0 16px" }}>
          <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
            Selection reference {running ? "· locked while a scan runs" : "(rehearsal label — the real adapter will use the native picker)"}
          </span>
          <input
            className="input"
            value={selectionLabel}
            disabled={running || !rehearsal}
            onChange={(e) => setSelectionLabel(e.target.value)}
            placeholder={rehearsal ? "demo-projects" : "Unavailable until the adapter is connected"}
          />
        </label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            className="btn danger"
            onClick={startScan}
            disabled={running || !rehearsal}
            title={rehearsal ? undefined : "Unavailable — the scan adapter is not connected"}
          >
            <Icon name="play" size={14} />
            {running ? "RUNNING…" : "START SCAN"}
          </button>
          <button
            type="button"
            ref={cancelRef}
            className="btn ghost"
            onClick={cancelScan}
            disabled={!running}
          >
            CANCEL
          </button>
          {!rehearsal && !running && (
            <span className="btn-note" style={{ marginInlineStart: 4 }}>
              Real inspection stays disabled until the adapter is connected — no silent no-op.
            </span>
          )}
        </div>
        {error && (
          <p style={{ color: "var(--danger)", fontFamily: "var(--font-mono)", fontSize: 12.5, marginTop: 12 }}>
            {error}
          </p>
        )}
      </section>

      {progress && (
        <section className="panel">
          <h3 className="panel-title">
            PROGRESS{" "}
            <span style={{ color: "var(--text-faint)", fontSize: 11, letterSpacing: "0.1em" }}>
              · TYPED COUNTERS · ISSUE #9 CONTRACT
            </span>
          </h3>
          {progress.stage === "running" && (
            <div style={{ margin: "10px 0 16px" }}>
              <div
                aria-hidden="true"
                style={{
                  height: 6,
                  borderRadius: 99,
                  background: "rgba(47,137,227,0.15)",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  className="lattice-sweep"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "40%",
                    borderRadius: 99,
                    background: "linear-gradient(90deg, transparent, var(--blue), transparent)",
                    animation: "edge-sweep 1.4s linear infinite",
                  }}
                />
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--text-dim)" }}>
                Traversal running — totals and percent are unknown; counters below are
                cumulative observations.
              </p>
            </div>
          )}
          <div className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            {COUNTERS.map(({ key, label }) => (
              <div className="stat" key={key}>
                <div className="num" style={{ fontSize: 22 }}>{progress[key] as string}</div>
                <div className="label">{label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0 0" }}>
            <span className={`badge ${progress.traversalComplete ? "ok" : "warn"}`}>
              {progress.traversalComplete ? "Traversal complete" : "Traversal incomplete"}
            </span>
            {progress.cancelled && <span className="badge warn">Cancelled by user</span>}
            {progress.limitReached && <span className="badge warn">Bound reached</span>}
          </div>
          {hasGaps && (
            <p style={{ color: "var(--warn)", fontSize: 13, marginTop: 12 }}>
              Not every entry was checked — skips, access errors or bounds reduced
              coverage. This result is incomplete by design and is never shown as clean.
            </p>
          )}

        </section>
      )}

      {report && (
        <section className="panel">
          <h3 className="panel-title">
            EVIDENCE REPORT{" "}
            <span className="mono" style={{ color: "var(--text-faint)", fontSize: 11 }}>
              · {report.jobId} · {report.selectionRef}
            </span>
          </h3>
          <div style={{ display: "grid", gap: 8, margin: "12px 0" }}>
            {"sha256" in report && report.sha256 && (
              <div>
                <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>SHA-256 · </span>
                <span className="mono" style={{ color: "var(--text)" }}>{report.sha256}</span>
              </div>
            )}
            {"sha256" in report && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>Outcome ·</span>
                <OutcomeBadge state={report.state} />
              </div>
            )}
            {"findings" in report && (
              <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
                Findings recorded: {String(report.findings.length)} · omitted: {report.findingsOmitted}
                {report.findings.length === 0 && " — none recorded in this rehearsal"}
              </div>
            )}
            <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
              Coverage: <b style={{ color: "var(--text)" }}>partial</b> · full signature
              engine active: <b style={{ color: "var(--text)" }}>no</b>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
