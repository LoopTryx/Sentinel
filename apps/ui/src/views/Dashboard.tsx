import { useEffect, useState } from "react";
import { backendInvoke, hasBackend } from "../backend";
import { useThreat } from "../state";
import Grainient from "../components/ui/Grainient";
import Icon from "../components/Icon";

interface AppStatus {
  threats_total: number;
  quarantined_total: number;
  signatures: number;
  protection: string;
}

/**
 * Console dashboard — the owner's reference layout (hero flex, wide activity
 * card + right rail, section heads). Two honest modes, switched by a real
 * backend probe:
 * - LIVE (desktop shell answers `app_status`): the sentinel-av engine runs —
 *   green "Live protection active" chip, real counters, real EICAR simulation.
 * - PREVIEW (no backend): "Preview · no agent connection", em-dash tiles,
 *   synthetic theme-only scenario. Nothing fakes success in either mode.
 */

/** Shield modules — honest statuses: local lessons and unavailable/planned runtime capabilities. */
const SHIELD_MODULES: {
  group: string;
  modules: { name: string; desc: string; status: "LOCAL LESSON" | "UNAVAILABLE" | "PLANNED" }[];
}[] = [
  {
    group: "CORE",
    modules: [
      { name: "Antivirus Engine", desc: "Console adapter unavailable · CLI preview only", status: "UNAVAILABLE" },
      { name: "Password Lab", desc: "entropy analysis · crypto generator", status: "LOCAL LESSON" },
    ],
  },
  {
    group: "PERIMETER",
    modules: [
      { name: "USB Shield", desc: "removable drive auto-scan on arrival", status: "PLANNED" },
      { name: "Watchtower", desc: "local text clues · no network monitoring", status: "LOCAL LESSON" },
    ],
  },
  {
    group: "GATEWAY",
    modules: [
      { name: "Web Shield", desc: "link & download inspection", status: "PLANNED" },
      { name: "Browser Guard", desc: "mail / chat / QR protection", status: "PLANNED" },
    ],
  },
];

const statusLabel =
  ({
    preview: "Preview · agent unavailable",
    warn: "Preview · scenario attention",
    danger: "Preview · scenario alert",
  } as Record<string, string>);

export default function Dashboard({ onViewAll }: { onViewAll: () => void }) {
  const { level, feed, setLevel, push } = useThreat();
  const [live, setLive] = useState(false);
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simDone, setSimDone] = useState(false);

  // Live probe: when the desktop shell answers, this console runs the real
  // sentinel-av engine and says so; otherwise the honest preview stays.
  useEffect(() => {
    if (!hasBackend()) return;
    const refresh = () =>
      backendInvoke<AppStatus>("app_status")
        .then((st) => {
          setLive(true);
          setStatus(st);
        })
        .catch(() => setLive(false));
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, []);

  async function simulateAttack() {
    if (live) {
      setSimulating(true);
      setSimDone(false);
      try {
        await backendInvoke("simulate_attack");
        setSimDone(true);
      } finally {
        setSimulating(false);
      }
      return;
    }
    // Preview mode: theme-only illustration, clearly labeled.
    setLevel("danger");
    push({
      kind: "scenario",
      level: "danger",
      message: "Synthetic suspicious-file illustration — no file was created, scanned or contained",
      detail: null,
      ts: new Date().toLocaleTimeString(),
    });
  }

  function resetConsole() {
    setSimDone(false);
    setLevel("preview");
  }

  return (
    <>
      {/* ── HERO — grainient gradient; title block left, status pill right ── */}
      <section className="panel" style={{ padding: 0, overflow: "hidden", border: "none" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.9 }}>
          <Grainient
            color1={level === "danger" ? "#c2483c" : level === "warn" ? "#b3813a" : "#2f89e3"}
            color2={level === "danger" ? "#3d0f0c" : "#16324F"}
            color3="#0a0e1f"
            timeSpeed={0.18}
            warpStrength={1.2}
            rotationAmount={420}
            grainAmount={0.14}
            grainAnimated
          />
        </div>
        <div className="hero-flex" style={{ position: "relative", zIndex: 1, padding: "34px 36px 30px" }}>
          <div style={{ minWidth: 0 }}>
            <div
              className="sticker-chip"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                transform: "rotate(-2deg)",
                padding: "7px 14px",
                borderRadius: 8,
                border: "2px solid rgba(155,120,255,0.75)",
                background: live
                  ? "linear-gradient(180deg, #7dffb2, #2fd67e)"
                  : "linear-gradient(180deg, #74b3f5, #2f89e3)",
                color: "#04220f",
                fontFamily: "var(--font-mono)",
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: "0.14em",
                boxShadow: "0 4px 18px rgba(47, 214, 126, 0.35), 0 0 0 4px rgba(18,18,24,0.55)",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 99,
                  background: "#04220f",
                  display: "inline-block",
                }}
              />
              {live ? "Live protection active" : "Preview · no agent connection"}
            </div>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 44,
                letterSpacing: "0.02em",
                margin: "14px 0 10px",
                color: "#F4F7FF",
                textShadow: "0 2px 24px rgba(10,14,31,0.6)",
              }}
            >
              SENTINEL
            </h2>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12.5,
                letterSpacing: "0.06em",
                color: "rgba(226,233,246,0.92)",
                textShadow: "0 1px 8px rgba(10,14,31,0.8)",
              }}
            >
              {live
                ? "Signature engine online · YARA rules loaded · vault encrypted"
                : "No live protection is installed — learning and presentation preview"}
            </div>
          </div>
          <div className="protection-pill" style={{ flexShrink: 0, alignSelf: "flex-start" }}>
            <span className="led" />
            {live
              ? level === "danger"
                ? "Threat contained"
                : level === "warn"
                  ? "Needs attention"
                  : "All systems secure"
              : statusLabel[level] ?? statusLabel.preview}
          </div>
        </div>
      </section>

      {/* ── STAT TILES — real engine numbers in live mode, honest em-dashes in preview ── */}
      <div className="stat-grid">
        <div className="stat">
          <div className="num">{live && status ? status.signatures : "—"}</div>
          <div className="label">SIGNATURES LOADED</div>
        </div>
        <div className="stat">
          <div className="num">{live && status ? status.threats_total : "—"}</div>
          <div className="label">THREATS CAUGHT</div>
        </div>
        <div className="stat">
          <div className="num">{live && status ? status.quarantined_total : "—"}</div>
          <div className="label">IN VAULT</div>
        </div>
      </div>

      {/* ── MAIN GRID — wide activity feed left, scenario rail right ── */}
      <div className="console-grid">
        <section className="panel" style={{ display: "flex", flexDirection: "column" }}>
          <div className="section-head">
            <h3 className="panel-title" style={{ margin: 0 }}>
              {live ? "ACTIVITY" : "SCENARIO ACTIVITY"}
            </h3>
            <button className="section-link" onClick={onViewAll}>
              View all
            </button>
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              lineHeight: 1.75,
              overflowY: "auto",
              maxHeight: 300,
              padding: "8px 0 0",
            }}
          >
            {feed.length === 0 && (
              <div style={{ color: "var(--text-faint)" }}>
                {live
                  ? "// telemetry channel open — waiting for events..."
                  : "// live telemetry unavailable — choose a labeled scenario"}
              </div>
            )}
            {feed.slice(0, 30).map((l) => (
              <div
                key={l.seq}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "7px 0",
                  borderBottom: "1px solid var(--grid-line)",
                  color:
                    l.level === "danger"
                      ? "var(--danger)"
                      : l.level === "warn"
                        ? "var(--warn)"
                        : "var(--text-dim)",
                }}
              >
                <span style={{ opacity: 0.55, flexShrink: 0 }}>{l.ts}</span>
                <span
                  style={{
                    fontWeight: l.level === "info" ? 400 : 600,
                    minWidth: 0,
                    overflowWrap: "anywhere",
                  }}
                >
                  {l.message}
                </span>
              </div>
            ))}
          </div>
        </section>

        <div className="side-rail">
          <section className="panel">
            <h3 className="panel-title">{live ? "ATTACK SIMULATION — LIVE DEMO" : "SYNTHETIC SCENARIO"}</h3>
            <p style={{ color: "var(--text-dim)", fontSize: 13, lineHeight: 1.6, margin: "0 0 14px" }}>
              {live
                ? "Stages a safe EICAR test attack, then watch the shield detect, isolate and neutralize it in real time."
                : "Changes the console theme using invented evidence. No file, device or system policy is touched."}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn danger" onClick={simulateAttack} disabled={simulating}>
                <Icon name="play" size={14} />
                {live ? (simulating ? "ENGAGED…" : "SIMULATE ATTACK") : "PREVIEW ALERT"}
              </button>
              <button className="btn ghost" onClick={resetConsole}>
                RESET CONSOLE
              </button>
            </div>
            {live && simDone && level === "danger" && (
              <div
                style={{
                  marginTop: 14,
                  color: "var(--danger)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12.5,
                }}
              >
                Attack simulated → detected → neutralized. Check the Vault.
              </div>
            )}
          </section>

          <section className="panel">
            <h3 className="panel-title">CAPABILITY STATUS</h3>
            <div className="kv-row">
              <span className="kv-key">
                Antivirus engine <span className="status-dot" style={{ display: "inline-block" }} />
              </span>
              <span className="kv-val" style={{ color: live ? "var(--state)" : "var(--warn)" }}>
                {live ? "live" : "unavailable"}
              </span>
            </div>
            <div className="kv-row">
              <span className="kv-key">Vault backend</span>
              <span className="kv-val" style={{ color: live ? "var(--state)" : "var(--warn)" }}>
                {live ? "live" : "unavailable"}
              </span>
            </div>
            <div className="kv-row" style={{ borderBottom: "none" }}>
              <span className="kv-key">Local lessons</span>
              <span className="kv-val" style={{ color: "var(--state)" }}>
                available
              </span>
            </div>
          </section>
        </div>
      </div>

      {/* ── SHIELD MODULES — section head outside, grid inside ── */}
      <div>
        <div className="section-head" style={{ marginBottom: 12 }}>
          <h3 className="panel-title" style={{ margin: 0, fontSize: 19 }}>
            SHIELD MODULES
          </h3>
        </div>
        <section className="panel">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
            {SHIELD_MODULES.map((g) => (
              <div
                key={g.group}
                style={{
                  border: "1px solid var(--grid-line)",
                  borderRadius: "var(--radius-sm)",
                  padding: "16px 18px",
                  background: "rgba(11, 18, 48, 0.55)",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    letterSpacing: "0.18em",
                    color: "var(--chrome-mid)",
                    marginBottom: 12,
                  }}
                >
                  {g.group}
                </div>
                {g.modules.map((m) => (
                  <div key={m.name} style={{ padding: "8px 0", borderTop: "1px solid var(--grid-line)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 99,
                          flexShrink: 0,
                          background: m.status === "LOCAL LESSON" ? "var(--safe)" : "var(--text-faint)",
                          boxShadow: m.status === "LOCAL LESSON" ? "0 0 8px var(--safe)" : "none",
                        }}
                      />
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{m.name}</span>
                      <span
                        style={{
                          marginLeft: "auto",
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          letterSpacing: "0.1em",
                          color: m.status === "LOCAL LESSON" ? "var(--safe)" : "var(--text-faint)",
                        }}
                      >
                        {m.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 3, paddingLeft: 14 }}>
                      {m.desc}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
