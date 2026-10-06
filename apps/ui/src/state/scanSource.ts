import type { DirectoryScanProgress, ScanReport } from "./scanTypes";

/**
 * Scan source seam for the Scan Center (issue-9 handoff: "GLM: consume on your
 * branch after adapter availability"). Two implementations exist today:
 *
 * - UnavailableScanSource — the honest default. The reviewed scanner has no
 *   native/Tauri adapter yet (no selection/job wrapper is registered), so real
 *   inspection is visibly disabled, never faked.
 * - RehearsalScanSource — a clearly labeled rehearsal that replays recorded
 *   benign scan sequences shaped exactly like the issue-9 DTOs so the UI
 *   journeys (running/finished, gaps, cancel, errors) can be exercised before
 *   the adapter lands. It never touches the filesystem.
 */

export type ScanSelection = { kind: "file" | "directory"; label: string };

export type ScanEvent =
  | { type: "progress"; progress: DirectoryScanProgress }
  | { type: "report"; report: ScanReport };

export interface ScanSource {
  readonly kind: "unavailable" | "rehearsal";
  start(selection: ScanSelection, onEvent: (event: ScanEvent) => void): Promise<void>;
  cancel(): void;
}

export function unavailableScanSource(reason: string): ScanSource {
  return {
    kind: "unavailable",
    start: () => Promise.reject(new Error(reason)),
    cancel: () => {},
  };
}

export type RehearsalScenario = "benign" | "gaps" | "cancel";

const zero = "0";

function progress(partial: Partial<DirectoryScanProgress>): DirectoryScanProgress {
  return {
    stage: "running",
    entriesVisited: zero,
    filesVisited: zero,
    filesChecked: zero,
    filesSkipped: zero,
    accessErrors: zero,
    engineFailures: zero,
    bytesRead: zero,
    traversalComplete: false,
    cancelled: false,
    limitReached: false,
    ...partial,
  };
}

/** Recorded snapshot sequences shaped like the issue-9 wire examples. */
const SEQUENCES: Record<Exclude<RehearsalScenario, "cancel">, DirectoryScanProgress[]> = {
  benign: [
    progress({ stage: "running" }),
    progress({ stage: "running", entriesVisited: "3", filesVisited: "2", filesChecked: "1", bytesRead: "8192" }),
    progress({ stage: "running", entriesVisited: "5", filesVisited: "4", filesChecked: "3", bytesRead: "20480" }),
    progress({
      stage: "finished",
      entriesVisited: "5",
      filesVisited: "4",
      filesChecked: "4",
      filesSkipped: "1",
      accessErrors: "0",
      engineFailures: "0",
      bytesRead: "24576",
      traversalComplete: true,
    }),
  ],
  gaps: [
    progress({ stage: "running" }),
    progress({ stage: "running", entriesVisited: "4", filesVisited: "3", filesChecked: "1", filesSkipped: "1", accessErrors: "1", bytesRead: "4096" }),
    progress({
      stage: "finished",
      entriesVisited: "9",
      filesVisited: "7",
      filesChecked: "2",
      filesSkipped: "3",
      accessErrors: "2",
      engineFailures: "1",
      bytesRead: "8192",
      traversalComplete: false,
      limitReached: true,
    }),
  ],
};

const STEP_MS = 550;

export function rehearsalScanSource(): ScanSource {
  let cancelled = false;
  return {
    kind: "rehearsal",
    cancel() {
      cancelled = true;
    },
    start(selection, onEvent) {
      cancelled = false;
      const scenario: "benign" | "gaps" = selection.label === "gaps" ? "gaps" : "benign";
      const snapshots = [...SEQUENCES[scenario]];
      return new Promise<void>((resolve) => {
        let index = 0;
        const step = () => {
          if (cancelled) {
            // Cancellation is observed at the next entry boundary; the last
            // known counters are retained with incomplete coverage.
            const last = snapshots[index - 1] ?? progress({});
            onEvent({
              type: "progress",
              progress: { ...last, stage: "finished", cancelled: true, traversalComplete: false },
            });
            resolve();
            return;
          }
          if (index < snapshots.length) {
            onEvent({ type: "progress", progress: snapshots[index] });
            index += 1;
            setTimeout(step, STEP_MS);
            return;
          }
          const final = snapshots[snapshots.length - 1];
          onEvent({
            type: "report",
            report:
              selection.kind === "file"
                ? {
                    jobId: "rehearsal-job-1",
                    selectionRef: `rehearsal://${selection.label}`,
                    state: "no_known_finding",
                    coverage: "partial",
                    bytesRead: final.bytesRead,
                    sha256: "3b7a1e9c0d5f2a8e6c4b1d3f7a9e0c5b2d8f6a4c1e3b7d9f0a2c4e6b8d1f3a5c",
                    filesVisited: "1",
                    filesChecked: "1",
                    filesSkipped: "0",
                    accessErrors: "0",
                    engineFailures: "0",
                    fullSignatureEngineActive: false,
                  }
                : {
                    jobId: "rehearsal-job-1",
                    selectionRef: `rehearsal://${selection.label}`,
                    progress: final,
                    coverage: "partial",
                    fullSignatureEngineActive: false,
                    findings: [],
                    findingsOmitted: "0",
                  },
          });
          resolve();
        };
        setTimeout(step, STEP_MS);
      });
    },
  };
}
