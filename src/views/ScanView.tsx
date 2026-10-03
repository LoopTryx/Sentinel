import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import LatticeLoader from "../components/ui/LatticeLoader";
import MagicBento from "../components/ui/MagicBento";

interface Detection {
  source: string;
  name: string;
  detail: string;
}
interface ScanReport {
  path: string;
  sha256: string;
  size: number;
  verdict: string;
  detections: Detection[];
  scan_ms: number;
}
interface ScanOutcome {
  reports: ScanReport[];
  malicious: number;
  suspicious: number;
  clean: number;
  quarantined: number;
}
interface DriveInfo {
  letter: string;
  exists: boolean;
}

type Phase = "idle" | "working" | "done" | "error";

const EMPTY_OUTCOME: ScanOutcome = {
  reports: [],
  malicious: 0,
  suspicious: 0,
  clean: 0,
  quarantined: 0,
};

export default function ScanView() {
  const [path, setPath] = useState("");
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    invoke<DriveInfo[]>("list_drives")
      .then(setDrives)
      .catch(() => {});
  }, []);

  /** Scan one or more dropped/picked targets, aggregating the outcomes. */
  async function scanMany(targets: string[]) {
    const clean = targets.map((t) => t.trim()).filter(Boolean);
    if (clean.length === 0) return;
    setPhase("working");
    setError(null);
    setOutcome(null);
    try {
      const merged: ScanOutcome = { ...EMPTY_OUTCOME, reports: [] };
      for (const t of clean) {
        const res = await invoke<ScanOutcome>("scan_path", { path: t });
        merged.malicious += res.malicious;
        merged.suspicious += res.suspicious;
        merged.clean += res.clean;
        merged.quarantined += res.quarantined;
        merged.reports.push(...res.reports);
      }
      setOutcome(merged);
      setPhase(merged.malicious > 0 ? "error" : "done");
    } catch (e) {
      setError(String(e));
      setPhase("error");
    }
  }

  function scan(target?: string) {
    const t = (target ?? path).trim();
    if (t) scanMany([t]);
  }

  // ---- drag & drop: native webview events (HTML5 dnd is intercepted) ----
  useEffect(() => {
    const unlistenPromise = getCurrentWebview().onDragDropEvent((event) => {
      const p = event.payload;
      if (p.type === "enter" || p.type === "over") {
        setDragging(true);
      } else if (p.type === "leave") {
        setDragging(false);
      } else if (p.type === "drop") {
        setDragging(false);
        if (p.paths.length > 0) scanMany(p.paths);
      }
    });
    return () => {
      unlistenPromise.then((un) => un()).catch(() => {});
    };
  }, []);

  // ---- pickers: every failure now surfaces in the UI, never silently ----
  // The app window is focused first so the native dialog can never open
  // behind it (the classic "button does nothing" experience).
  async function pickFile() {
    try {
      await getCurrentWindow().setFocus();
      const picked = await open({
        multiple: true,
        title: "Pick file(s) to inspect",
      });
      if (Array.isArray(picked) && picked.length > 0) {
        setPath(picked[0]);
        await scanMany(picked);
      } else if (typeof picked === "string" && picked) {
        setPath(picked);
        await scanMany([picked]);
      }
      // picked === null → user cancelled, no error needed
    } catch (e) {
      setError(`File picker failed: ${e}`);
    }
  }

  async function pickFolder() {
    try {
      await getCurrentWindow().setFocus();
      const picked = await open({
        directory: true,
        multiple: false,
        title: "Pick a folder to scan",
      });
      if (typeof picked === "string" && picked) {
        setPath(picked);
        await scanMany([picked]);
      }
    } catch (e) {
      setError(`Folder picker failed: ${e}`);
    }
  }

  const bentoSummary = outcome
    ? [
        {
          color: "#0B1230",
          title: `${outcome.clean}`,
          description: "files came back clean after inspection",
          label: "CLEAN",
        },
        {
          color: "#0B1230",
          title: `${outcome.suspicious}`,
          description: "suspicious — heuristic or YARA rule tripped",
          label: "SUSPICIOUS",
        },
        {
          color: "#0B1230",
          title: `${outcome.malicious}`,
          description: "malicious samples detected and quarantined",
          label: "MALICIOUS",
        },
        {
          color: "#0B1230",
          title: `${outcome.quarantined}`,
          description: "encrypted in the vault, inert forever",
          label: "IN VAULT",
        },
      ]
    : [];

  return (
    <>
      <section
        className="panel"
        style={
          dragging
            ? {
                outline: "2px dashed var(--cyan)",
                outlineOffset: -8,
                background:
                  "linear-gradient(160deg, rgba(53,224,255,0.10), var(--bg-deep))",
              }
            : undefined
        }
      >
        <h3 className="panel-title">Virus Sample Detector</h3>
        <p
          style={{
            color: "var(--text-dim)",
            fontSize: 13,
            lineHeight: 1.6,
            margin: "0 0 16px",
          }}
        >
          Drag files or folders anywhere onto this panel — or use the buttons —
          and SENTINEL checks every file against YARA rules, known signature
          hashes and behavioral heuristics, then neutralizes what it catches.
        </p>

        {/* dropzone */}
        <div
          onClick={pickFile}
          style={{
            border: "2px dashed rgba(28, 225, 203, 0.30)",
            borderRadius: "var(--radius)",
            padding: "26px 18px",
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.2s ease",
            background: dragging ? "rgba(28,225,203,0.08)" : "transparent",
            borderColor: dragging ? "var(--cyan)" : "rgba(28, 225, 203, 0.30)",
            marginBottom: 16,
            userSelect: "none",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 17,
              letterSpacing: 1,
              color: dragging ? "var(--cyan)" : "var(--text-dim)",
            }}
          >
            {dragging ? "◎ RELEASE TO SCAN" : "⬇ DROP FILES / FOLDERS HERE"}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--text-faint)",
              marginTop: 6,
            }}
          >
            or click to browse · multiple files supported
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="btn" onClick={pickFile}>
            ⬆ Upload File
          </button>
          <button className="btn" onClick={pickFolder}>
            📁 Upload Folder
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 16,
            alignItems: "center",
          }}
        >
          <input
            className="input"
            placeholder="…or paste a path: C:\Users\...\Downloads  or  E:\"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && scan()}
          />
          <button
            className="btn"
            onClick={() => scan()}
            disabled={phase === "working" || !path.trim()}
          >
            {phase === "working" ? "Scanning…" : "Scan"}
          </button>
        </div>

        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span
            style={{
              color: "var(--text-faint)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
            }}
          >
            QUICK TARGETS:
          </span>
          {drives
            .filter((d) => d.exists)
            .map((d) => (
              <button
                key={d.letter}
                className="btn ghost"
                style={{ padding: "6px 12px" }}
                onClick={() => {
                  setPath(d.letter + "\\");
                  scan(d.letter + "\\");
                }}
              >
                {d.letter}
              </button>
            ))}
        </div>

        {phase !== "idle" && (
          <div style={{ marginTop: 18, color: "var(--cyan)" }}>
            <LatticeLoader
              label="Inspecting samples"
              doneLabel="Inspection finished in"
              errorLabel="Threats found — finished in"
              status={phase}
              pattern="sweep"
              grid={4}
              shape="round"
              color="var(--cyan)"
              doneColor="var(--safe)"
              errorColor="var(--danger)"
              glow
              fontSize={15}
            />
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              border: "1px solid var(--danger)",
              borderRadius: "var(--radius-sm)",
              background: "rgba(255,138,122,0.08)",
              color: "var(--danger)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              wordBreak: "break-all",
            }}
          >
            ⚠ {error}
          </div>
        )}
      </section>

      {outcome && (
        <section className="panel">
          <h3 className="panel-title">Sample Analysis</h3>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <MagicBento cards={bentoSummary} enableSpotlight enableBorderGlow />
          </div>

          {outcome.reports.length > 0 && (
            <table style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th>Verdict</th>
                  <th>File</th>
                  <th>Detections</th>
                  <th>SHA-256</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {outcome.reports.map((r) => (
                  <tr key={r.path}>
                    <td>
                      <span className={`badge ${r.verdict}`}>{r.verdict}</span>
                    </td>
                    <td>{r.path}</td>
                    <td>
                      {r.detections.map((d) => (
                        <div key={d.name + d.source}>
                          [{d.source}] {d.name} — {d.detail}
                        </div>
                      ))}
                    </td>
                    <td>{r.sha256.slice(0, 16)}…</td>
                    <td>{r.scan_ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </>
  );
}
